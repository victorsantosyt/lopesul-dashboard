// src/lib/scheduler.js
// Worker simples para expirar pedidos/sessões e garantir liberação/revogação
// no Mikrotik. Agora integrado com o fluxo multi-Mikrotik baseado em Pedido.

import prisma from '@/lib/prisma';
import mikrotik from '@/lib/mikrotik';
import { liberarAcessoPorPedido, revogarAcessoPorSessao } from '@/lib/mikrotikService';

const { liberarCliente: legacyLiberarCliente, revogarCliente: legacyRevogarCliente } = mikrotik;

const PLANOS_MIN = {
  'Acesso 12h': 12 * 60,
  'Acesso 24h': 24 * 60,
  'Acesso 48h': 48 * 60,
};

const DEFAULT_MIN = 120;

function pickMinutes(obj = {}) {
  const desc =
    obj.plano ||
    obj.descricao ||
    obj.plan ||
    obj.product ||
    '';

  if (desc && PLANOS_MIN[desc]) return PLANOS_MIN[desc];

  const min = Number(obj.minutos);
  if (Number.isFinite(min) && min > 0) return min;

  return DEFAULT_MIN;
}

function pickIpMac(obj = {}) {
  const ip = obj.ip || obj.clienteIp || obj.ipCliente || null;
  const mac = obj.mac || obj.clienteMac || obj.deviceMac || obj.macCliente || null;
  return { ip, mac };
}

function hasModel(name) {
  return !!prisma?.[name];
}

async function expiraPendentes(now) {
  const cutoff = new Date(now.getTime() - 5 * 60 * 1000);

  // pagamentos legados
  if (hasModel('pagamento')) {
    await prisma.pagamento.updateMany({
      where: {
        status: 'pendente',
        expiraEm: { lt: cutoff },
      },
      data: { status: 'expirado' },
    }).catch(() => {});
  }

  // pedidos novos
  if (hasModel('pedido')) {
    await prisma.pedido.updateMany({
      where: {
        status: 'PENDING',
        // se tiver expiresAt no schema, usar; senão, usa createdAt + janela genérica
      },
      data: { status: 'EXPIRED' },
    }).catch(() => {});
  }
}

async function listaPagosSemSessao(limit = 25) {
  const out = [];

  // v1 (legado): pagamentos
  if (hasModel('pagamento')) {
    const pagos = await prisma.pagamento
      .findMany({
        where: { status: 'pago' },
        take: limit,
        orderBy: { id: 'desc' },
      })
      .catch(() => []);

    for (const pg of pagos) {
      const hasSessao = await prisma.sessaoAtiva
        .findFirst({ where: { pagamentoId: pg.id, ativo: true } })
        .catch(() => null);
      if (!hasSessao) out.push({ kind: 'pagamento', row: pg });
      if (out.length >= limit) break;
    }
  }

  // v2 (novo): pedidos pagos sem sessão
  if (out.length < limit && hasModel('pedido')) {
    const pedidos = await prisma.pedido
      .findMany({
        where: { status: 'PAID' },
        take: limit,
        orderBy: { id: 'desc' },
      })
      .catch(() => []);

    for (const pd of pedidos) {
      const hasSessao = await prisma.sessaoAtiva
        .findFirst({ where: { pedidoId: pd.id, ativo: true } })
        .catch(() => null);
      if (!hasSessao) out.push({ kind: 'pedido', row: pd });
      if (out.length >= limit) break;
    }
  }

  return out.slice(0, limit);
}

async function criaSessaoEAbreMikrotik(kind, row, now) {
  const minutos = pickMinutes(row);
  const { ip, mac } = pickIpMac(row);

  // Caminho novo (recomendado): Pedido -> mikrotikService (multi-Mikrotik)
  if (kind === 'pedido') {
    try {
      const res = await liberarAcessoPorPedido({
        pedido: row,
        ipOverride: ip || null,
        macOverride: mac || null,
        origem: 'scheduler',
        minutos,
        criarSessao: true,
      });

      console.log('[scheduler] liberarAcessoPorPedido', {
        pedidoId: row.id,
        roteadorId: res.roteadorId,
        sessaoId: res.sessaoId,
        ok: res.ok,
      });
      return;
    } catch (e) {
      console.error('[scheduler] Erro em liberarAcessoPorPedido (fallback para legado):', e);
      // cai para o fluxo legado abaixo
    }
  }

  // Fluxo legado (pagamento antigo ou fallback): mantém compatibilidade,
  // mas não é multi-Mikrotik completo.
  const expira = new Date(now.getTime() + minutos * 60 * 1000);

  const baseSessao = {
    ipCliente: ip || `sem-ip-${row.id}`.slice(0, 255),
    macCliente: mac || null,
    plano: row?.plano || row?.descricao || 'Acesso',
    inicioEm: now,
    expiraEm: expira,
    ativo: true,
  };

  const sessaoData =
    kind === 'pagamento'
      ? { ...baseSessao, pagamentoId: row.id }
      : { ...baseSessao, pedidoId: row.id };

  await prisma.sessaoAtiva.create({ data: sessaoData }).catch(() => {});

  await legacyLiberarCliente({
    ip: ip || undefined,
    mac: mac || undefined,
    minutos,
  }).catch(() => {});
}

async function revogaVencidas(now) {
  if (!hasModel('sessaoAtiva')) return;

  const vencidas = await prisma.sessaoAtiva
    .findMany({
      where: { ativo: true, expiraEm: { lt: now } },
      take: 50,
      orderBy: { expiraEm: 'asc' },
    })
    .catch(() => []);

  for (const s of vencidas) {
    await prisma.sessaoAtiva
      .update({ where: { id: s.id }, data: { ativo: false } })
      .catch(() => {});

    // Tenta fluxo novo multi-Mikrotik primeiro
    try {
      const res = await revogarAcessoPorSessao({ sessao: s });
      console.log('[scheduler] revogarAcessoPorSessao', {
        sessaoId: s.id,
        roteadorId: res.roteadorId,
        ok: res.ok,
      });
      continue;
    } catch (e) {
      console.error('[scheduler] Erro em revogarAcessoPorSessao (fallback para legado):', e);
    }

    const ip = s?.ipCliente || null;
    const mac = s?.macCliente || null;

    await legacyRevogarCliente({
      ip: ip || undefined,
      mac: mac || undefined,
    }).catch(() => {});
  }
}

async function tick() {
  const now = new Date();

  // 1) expirar pendentes
  await expiraPendentes(now);

  // 2) criar sessões para pagos sem sessão + liberar no Mikrotik
  const pendentesDeSessao = await listaPagosSemSessao(25);
  for (const item of pendentesDeSessao) {
    await criaSessaoEAbreMikrotik(item.kind, item.row, now);
  }

  // 3) revogar sessões vencidas
  await revogaVencidas(now);
}

function start() {
  if (globalThis.__scheduler_started) return;
  globalThis.__scheduler_started = true;

  console.log('[scheduler] iniciado (tick 60s)');
  setInterval(() => {
    tick().catch((e) => console.error('[scheduler] tick error', e));
  }, 60 * 1000);
}

export function ensureScheduler() {
  start();
}

export default {
  start,
  ensureScheduler,
};
