// src/lib/mikrotikService.ts
// Serviço de alto nível para liberação/revogação de acesso em múltiplos Mikrotiks
// baseado em Pedido / SessaoAtiva / roteadorId.

import prisma from '@/lib/prisma';
import type { Pedido, Roteador, SessaoAtiva } from '@prisma/client';
import {
  liberarClienteOnRouter,
  revogarClienteOnRouter,
  type LiberarClienteInput,
  type RevogarClienteInput,
} from '@/lib/mikrotikClient';

function pickIpMacFromPedido(pedido: Pedido, override?: { ip?: string | null; mac?: string | null }) {
  const ip = (override?.ip || pedido.ip || '').trim() || null;
  const mac = (override?.mac || pedido.deviceMac || '').trim().toUpperCase() || null;
  return { ip, mac };
}

function pickComment(pedido: Pedido, origem: string) {
  return `${origem}:${pedido.id}`.slice(0, 64);
}

async function resolveRoteadorFromPedido(pedido: Pedido): Promise<Roteador | null> {
  // 1) Se vier roteadorId dentro do metadata (futuro), usa direto
  const meta = pedido.metadata as any;
  if (meta && typeof meta === 'object' && meta.roteadorId && typeof meta.roteadorId === 'string') {
    const r = await prisma.roteador.findUnique({ where: { id: meta.roteadorId } });
    if (r) return r;
  }

  // 2) Se tiver busId, assume que aponta para a Frota correspondente
  if (pedido.busId) {
    const frota = await prisma.frota.findUnique({
      where: { id: pedido.busId },
      include: { roteador: true },
    }).catch(() => null);

    if (frota?.roteador) return frota.roteador;
    if (frota?.roteadorId) {
      const r = await prisma.roteador.findUnique({ where: { id: frota.roteadorId } });
      if (r) return r;
    }
  }

  return null;
}

export interface LiberaPorPedidoOptions {
  pedido: Pedido;
  ipOverride?: string | null;
  macOverride?: string | null;
  origem?: string; // ex.: 'webhook', 'api/liberar-acesso'
  minutos?: number | null;
  criarSessao?: boolean;
}

export interface LiberaPorPedidoResult {
  ok: boolean;
  pedidoId: string;
  roteadorId?: string | null;
  sessaoId?: string | null;
  mikrotik?: unknown;
}

export async function liberarAcessoPorPedido(
  opts: LiberaPorPedidoOptions
): Promise<LiberaPorPedidoResult> {
  const { pedido } = opts;
  const origem = opts.origem || 'pedido';

  const roteador = await resolveRoteadorFromPedido(pedido);
  if (!roteador) {
    console.warn('[mikrotikService] Nenhum roteador associado ao pedido', {
      pedidoId: pedido.id,
      busId: pedido.busId,
    });
    return {
      ok: false,
      pedidoId: pedido.id,
      roteadorId: null,
      mikrotik: { error: 'roteador_not_found' },
    };
  }

  const { ip, mac } = pickIpMacFromPedido(pedido, {
    ip: opts.ipOverride,
    mac: opts.macOverride,
  });

  if (!ip && !mac) {
    console.warn('[mikrotikService] Pedido sem IP/MAC para liberar', {
      pedidoId: pedido.id,
      roteadorId: roteador.id,
    });
    return {
      ok: false,
      pedidoId: pedido.id,
      roteadorId: roteador.id,
      mikrotik: { error: 'missing_ip_mac' },
    };
  }

  const username = `user_${pedido.id}`;
  const comment = pickComment(pedido, origem);

  const mkInput: LiberarClienteInput = {
    ip,
    mac,
    username,
    comment,
  };

  const mkResult = await liberarClienteOnRouter({ roteador }, mkInput);

  let sessaoId: string | null = null;

  if (opts.criarSessao) {
    const minutos = Number.isFinite(opts.minutos as number)
      ? (opts.minutos as number)
      : 120;
    const now = new Date();
    const expira = new Date(now.getTime() + minutos * 60 * 1000);

    const sessao = await prisma.sessaoAtiva.create({
      data: {
        ipCliente: ip || `sem-ip-${pedido.id}`.slice(0, 255),
        macCliente: mac || null,
        plano: pedido.description || 'Acesso',
        inicioEm: now,
        expiraEm: expira,
        ativo: true,
        pedidoId: pedido.id,
        roteadorId: roteador.id,
      },
    });
    sessaoId = sessao.id;
  }

  return {
    ok: mkResult.ok,
    pedidoId: pedido.id,
    roteadorId: roteador.id,
    sessaoId,
    mikrotik: mkResult,
  };
}

export interface RevogaPorSessaoOptions {
  sessao: SessaoAtiva;
  pedido?: Pedido | null;
}

export async function revogarAcessoPorSessao(
  opts: RevogaPorSessaoOptions
): Promise<MultiRevogaResult> {
  const { sessao } = opts;

  let roteador: Roteador | null = null;

  if (sessao.roteadorId) {
    roteador = await prisma.roteador.findUnique({ where: { id: sessao.roteadorId } });
  } else if (sessao.pedidoId) {
    const pedido = opts.pedido ||
      (await prisma.pedido.findUnique({ where: { id: sessao.pedidoId } }));
    if (pedido) {
      roteador = await resolveRoteadorFromPedido(pedido);
    }
  }

  if (!roteador) {
    console.warn('[mikrotikService] revogar: nenhum roteador para sessao', {
      sessaoId: sessao.id,
      pedidoId: sessao.pedidoId,
    });
    return {
      ok: false,
      roteadorId: null,
      mikrotik: { error: 'roteador_not_found' },
    };
  }

  const ip = sessao.ipCliente || null;
  const mac = (sessao.macCliente || '').trim().toUpperCase() || null;
  const username = sessao.pedidoId ? `user_${sessao.pedidoId}` : null;

  const mkInput: RevogarClienteInput = {
    ip,
    mac,
    username,
  };

  const mkResult = await revogarClienteOnRouter({ roteador }, mkInput);

  return {
    ok: mkResult.ok,
    roteadorId: roteador.id,
    mikrotik: mkResult,
  };
}

export interface MultiRevogaResult {
  ok: boolean;
  roteadorId: string | null;
  mikrotik?: unknown;
}
