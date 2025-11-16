// test-liberacao-e2e.js
// Teste automatizado (conceitual) para o fluxo:
// cliente paga -> webhook Pagar.me -> Pedido.PAID -> liberação no Mikrotik correto
// via mikrotikService (multi-roteador) -> SessaoAtiva com roteadorId.
//
// IMPORTANTE: este script presume um ambiente de teste.
// Não execute em produção.

import prisma from './src/lib/prisma.js';
import { POST as webhookHandler } from './src/app/api/webhooks/pagarme/route.js';
import { relayFetch } from './src/lib/relay.ts';

async function main() {
  console.log('=== Iniciando teste E2E de liberação ===');

  // 1) Preparar dados de teste: Roteador, Frota, Pedido
  const roteador = await prisma.roteador.create({
    data: {
      nome: 'TEST_BUS_01',
      ipLan: '10.200.200.2',
      usuario: process.env.MIKROTIK_USER || 'admin',
      senhaHash: 'test',
    },
  });

  const frota = await prisma.frota.create({
    data: {
      placa: 'TEST-0001',
      rotaLinha: 'LAB',
      roteadorId: roteador.id,
    },
  });

  const pedido = await prisma.pedido.create({
    data: {
      code: 'TEST_ORDER_1',
      amount: 1000,
      method: 'PIX',
      status: 'PENDING',
      ip: '192.168.88.10',
      deviceMac: 'AA:BB:CC:DD:EE:FF',
      busId: frota.id,
    },
  });

  console.log('Seed:', { roteadorId: roteador.id, frotaId: frota.id, pedidoId: pedido.id });

  // 2) Mock do relayFetch para capturar comandos enviados
  const commands = [];
  const origRelayFetch = relayFetch;
  globalThis.__relayFetch_mock = async (path, init) => {
    const body = JSON.parse(init?.body || '{}');
    commands.push({ path, body });
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: [] }),
    };
  };

  // Atenção: no código real, você teria que injetar esse mock no relay.ts.

  // 3) Simular webhook Pagar.me
  const evt = {
    type: 'order.paid',
    data: {
      order: {
        id: pedido.code,
        code: pedido.code,
        status: 'paid',
        charges: [
          {
            id: 'ch_test_1',
            status: 'paid',
            payment_method: 'pix',
            last_transaction: {
              status: 'paid',
            },
          },
        ],
      },
    },
  };

  const req = new Request('http://localhost/api/webhooks/pagarme', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(evt),
  });

  const res = await webhookHandler(req);
  const json = await res.json();

  console.log('Webhook resposta:', json);

  // 4) Verificar efeitos no banco
  const pedidoFinal = await prisma.pedido.findUnique({ where: { id: pedido.id } });
  const sessoes = await prisma.sessaoAtiva.findMany({ where: { pedidoId: pedido.id } });

  console.log('Pedido final:', {
    status: pedidoFinal?.status,
    busId: pedidoFinal?.busId,
  });

  console.log('Sessoes ativas:',
    sessoes.map((s) => ({ id: s.id, ip: s.ipCliente, mac: s.macCliente, roteadorId: s.roteadorId }))
  );

  console.log('Comandos enviados ao Mikrotik:', commands);

  console.log('=== Fim do teste E2E ===');
}

main().catch((e) => {
  console.error('Erro no teste E2E:', e);
  process.exit(1);
});
