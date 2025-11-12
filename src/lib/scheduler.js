// src/lib/scheduler.js
import prisma from '@/lib/prisma';
// mikrotik é default export no teu projeto; daí desestruturamos as funcs
import mikrotik from '@/lib/mikrotik';
const { liberarCliente, revogarCliente } = mikrotik;

const PLANOS_MIN = {
  'Acesso 12h': 12 * 60,
  'Acesso 24h': 24 * 60,
  'Acesso 48h': 48 * 60,
};

const DEFAULT_MIN = 120;

const hasModel = (name) => {
  const m = prisma?.[name];
  return !!m && typeof m === 'object';
};

const tryAwait = async (fn, fallback = null) => {
  try { return await fn(); } catch { return fallback; }
};

function pickMinutes(obj) {
  // tenta plano/descricao → mapa; senão cai no DEFAULT_MIN
  const label = obj?.plano || obj?.descricao || obj?.plan || obj?.product;
  if (label && PLANOS_MIN[label]) return PLANOS_MIN[label];
  // tenta campo direto em minutos (se existir)
  if (Number.isFinite(obj?.minutos)) return obj.minutos;
  return DEFAULT_MIN;
}

function pickIpMac(obj) {
  // cobre ambas versões
  const ip  = obj?.ip || obj?.clienteIp || obj?.ipCliente || null;
  const mac = obj?.mac || obj?.clienteMac || obj?.deviceMac || obj?.macCliente || null;
  return { ip, mac };
}

async function expiraPendentes(now) {
  // v1 (legado): pagamento.status 'pendente' com expiraEm
  if (hasModel('pagamento')) {
    await tryAwait(() =>
      prisma.pagamento.updateMany({
        where: { status: 'pendente', expiraEm: { lt: now } },
        data: { status: 'expirado' },
      })
    );
  }

  // v2 (novo): pedido.status 'PENDING' com expiresAt (se existir)
  if (hasModel('pedido')) {
    await tryAwait(async () => {
      // alguns esquemas usam expiresAt; se não existir, a query pode falhar — por isso tryAwait
      await prisma.pedido.updateMany({
        where: { status: 'PENDING', expiresAt: { lt: now } },
        data:  { status: 'EXPIRED' },
      });
    });
  }
}

async function listaPagosSemSessao(limit = 25) {
  const out = [];

  // v1 (legado): pagamentos pagos sem sessão
  if (hasModel('pagamento')) {
    const pagos = await tryAwait(() =>
      prisma.pagamento.findMany({
        where: { status: 'pago' },
        take: limit,
        orderBy: { id: 'desc' },
      }), []
    );

    for (const pg of pagos) {
      const hasSessao = await tryAwait(() =>
        prisma.sessaoAtiva.findFirst({ where: { pagamentoId: pg.id, ativo: true } })
      );
      if (!hasSessao) out.push({ kind: 'pagamento', row: pg });
      if (out.length >= limit) break;
    }
  }

  // v2 (novo): pedidos pagos sem sessão
  if (out.length < limit && hasModel('pedido')) {
    const pedidos = await tryAwait(() =>
      prisma.pedido.findMany({
        where: { status: 'PAID' },
        take: limit,
        orderBy: { id: 'desc' },
      }), []
    );

    for (const pd of pedidos) {
      const hasSessao = await tryAwait(() =>
        prisma.sessaoAtiva.findFirst({ where: { pedidoId: pd.id, ativo: true } })
      );
      if (!hasSessao) out.push({ kind: 'pedido', row: pd });
      if (out.length >= limit) break;
    }
  }

  return out.slice(0, limit);
}

async function criaSessaoEAbreMikrotik(kind, row, now) {
  const minutos = pickMinutes(row);
  const expira  = new Date(now.getTime() + minutos * 60 * 1000);
  const { ip, mac } = pickIpMac(row);

  // Campos da SessaoAtiva (tabela comum do teu projeto)
  const baseSessao = {
    ipCliente:  ip || `sem-ip-${row.id}`.slice(0, 255),
    macCliente: mac || null,
    plano:      row?.plano || row?.descricao || 'Acesso',
    inicioEm:   now,
    expiraEm:   expira,
    ativo:      true,
  };

  // liga foreign key de acordo com a origem
  const sessaoData = (kind === 'pagamento')
    ? { ...baseSessao, pagamentoId: row.id }
    : { ...baseSessao, pedidoId: row.id };

  await tryAwait(() => prisma.sessaoAtiva.create({ data: sessaoData }));

  // liberação no Mikrotik (defensivo)
  await tryAwait(() => liberarCliente({
    ip: ip || undefined,
    mac: mac || undefined,
    minutos,
  }));
}

async function revogaVencidas(now) {
  if (!hasModel('sessaoAtiva')) return;

  const vencidas = await tryAwait(() =>
    prisma.sessaoAtiva.findMany({
      where: { ativo: true, expiraEm: { lt: now } },
      take: 50,
      orderBy: { expiraEm: 'asc' },
    }), []
  );

  for (const s of vencidas) {
    await tryAwait(() =>
      prisma.sessaoAtiva.update({ where: { id: s.id }, data: { ativo: false } })
    );

    const ip = s?.ipCliente || null;
    const mac = s?.macCliente || null;

    await tryAwait(() => revogarCliente({
      ip: ip || undefined,
      mac: mac || undefined,
    }));
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
  setInterval(() => tick().catch(err => console.error('[scheduler] tick erro:', err)), 60_000);
  console.log('[scheduler] iniciado (tick 60s)');
}

export function ensureScheduler() {
  start();
}
