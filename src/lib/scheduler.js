import prisma from '@/lib/prisma';
import { liberarCliente, revogarCliente } from './mikrotik.js';

const PLANOS_MIN = {
  'Acesso 12h': 12 * 60,
  'Acesso 24h': 24 * 60,
  'Acesso 48h': 48 * 60,
};

async function tick() {
  const now = new Date();

  // 1) expira cobranças pendentes que passaram do expiraEm
  await prisma.pagamento.updateMany({
    where: { status: 'pendente', expiraEm: { lt: now } },
    data: { status: 'expirado' },
  });

  // 2) para pagamentos pagos que ainda NÃO geraram sessão, cria SessaoAtiva e libera Mikrotik
  const pagosSemSessao = await prisma.pagamento.findMany({
    where: { status: 'pago', sessoes: { none: {} } },
    take: 25,
  });

  for (const pg of pagosSemSessao) {
    const minutos = PLANOS_MIN[pg.plano] ?? 120;
    const expira = new Date(now.getTime() + minutos * 60 * 1000);

    await prisma.sessaoAtiva.create({
      data: {
        ipCliente: pg.ip || `sem-ip-${pg.id}`.slice(0, 255),
        macCliente: pg.mac || null,
        plano: pg.plano,
        inicioEm: now,
        expiraEm: expira,
        ativo: true,
        pagamentoId: pg.id,
      },
    });

    await liberarCliente({ ip: pg.ip || undefined, mac: pg.mac || undefined, minutos });
  }

  // 3) revoga acessos vencidos (SessaoAtiva expirada)
  const vencidas = await prisma.sessaoAtiva.findMany({
    where: { ativo: true, expiraEm: { lt: now } },
    take: 50,
  });

  for (const s of vencidas) {
    await prisma.sessaoAtiva.update({ where: { id: s.id }, data: { ativo: false } });
    await revogarCliente({ ip: s.ipCliente || undefined, mac: s.macCliente || undefined });
  }
}

function start() {
  if (globalThis.__scheduler_started) return;
  globalThis.__scheduler_started = true;
  setInterval(() => tick().catch(err => console.error('[scheduler] tick erro:', err)), 60_000);
  console.log('[scheduler] iniciado (tick 60s)');
}

export function ensureScheduler() { start(); }
