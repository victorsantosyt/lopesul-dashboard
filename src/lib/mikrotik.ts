// src/lib/mikrotik.ts
// Camada de compatibilidade + helpers mínimos de ambiente.
// As operações de liberação/revogação multi-Mikrotik vivem em mikrotikService.

import { liberarAcessoPorPedido, revogarAcessoPorSessao } from '@/lib/mikrotikService';
import prisma from '@/lib/prisma';

export function getMikrotikEnv() {
  const yes = (v?: string | null) => {
    if (!v) return false;
    const s = String(v).trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'on';
  };

  const host = process.env.MIKROTIK_HOST || process.env.MIKOTIK_HOST || '';
  const ssl = yes(process.env.MIKROTIK_SSL);
  const portEnv = process.env.PORTA_MIKROTIK || '';
  const port = portEnv ? Number(portEnv) : ssl ? 8729 : 8728;
  const timeout = Number(process.env.MIKROTIK_TIMEOUT_MS || '8000') || 8000;

  return {
    host,
    user: process.env.MIKROTIK_USER || '',
    pass: process.env.MIKROTIK_PASS || '',
    port,
    secure: ssl,
    timeout,
  };
}

/**
 * Função de alto nível usada pelo código legado para "liberarCliente".
 * Agora, ela delega para o fluxo multi-Mikrotik baseado em Pedido.
 *
 * Contract antigo aceitava apenas { ip, mac, minutos }. Aqui:
 * - Tentamos localizar um Pedido PAID sem sessão para aquele IP/MAC.
 * - Resolvido o Pedido, chamamos liberarAcessoPorPedido, que escolhe o
 *   roteador correto (via Frota.busId -> Roteador) e executa os comandos
 *   no Mikrotik certo.
 */
export async function liberarAcesso(args: { ip?: string | null; mac?: string | null; minutos?: number | null }) {
  const ip = (args.ip || '').trim() || null;
  const mac = (args.mac || '').trim().toUpperCase() || null;

  const pedido = await prisma.pedido.findFirst({
    where: {
      status: 'PAID',
      OR: [
        ip ? { ip } : undefined,
        mac ? { deviceMac: mac } : undefined,
      ].filter(Boolean) as any,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!pedido) {
    console.warn('[mikrotik] liberarAcesso: nenhum pedido PAID encontrado para IP/MAC', { ip, mac });
    return { ok: false, reason: 'pedido_not_found' };
  }

  const res = await liberarAcessoPorPedido({
    pedido,
    ipOverride: ip,
    macOverride: mac,
    origem: 'legacy/liberarAcesso',
    minutos: args.minutos ?? null,
    criarSessao: true,
  });

  return res;
}

export async function revogarAcesso(args: { ip?: string | null; mac?: string | null }) {
  const ip = (args.ip || '').trim() || null;
  const mac = (args.mac || '').trim().toUpperCase() || null;

  const sessao = await prisma.sessaoAtiva.findFirst({
    where: {
      ativo: true,
      OR: [
        ip ? { ipCliente: ip } : undefined,
        mac ? { macCliente: mac } : undefined,
      ].filter(Boolean) as any,
    },
    orderBy: { inicioEm: 'desc' },
  });

  if (!sessao) {
    console.warn('[mikrotik] revogarAcesso: nenhuma sessão ativa para IP/MAC', { ip, mac });
    return { ok: false, reason: 'sessao_not_found' };
  }

  const res = await revogarAcessoPorSessao({ sessao });

  // marca sessão como inativa de forma defensiva
  if (res.ok) {
    await prisma.sessaoAtiva.update({
      where: { id: sessao.id },
      data: { ativo: false, expiraEm: new Date() },
    }).catch(() => {});
  }

  return res;
}

const mikrotik = {
  getMikrotikEnv,
  liberarCliente: liberarAcesso,
  revogarCliente: revogarAcesso,
};

export default mikrotik;
