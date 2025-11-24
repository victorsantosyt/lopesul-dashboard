#!/bin/bash
# Script para monitorar teste real de pagamento
# Uso: bash monitorar-teste.sh [CODIGO_DO_PEDIDO]

PEDIDO_CODE="${1:-}"

echo "═══════════════════════════════════════════════════════════════"
echo "🔍 MONITORAMENTO DE TESTE REAL - LOPESUL DASHBOARD"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ -z "$PEDIDO_CODE" ]; then
  echo "📝 Aguardando criação de pedido..."
  echo "   Execute: bash monitorar-teste.sh [CODIGO_DO_PEDIDO]"
  echo ""
  echo "   Ou monitore pedidos recentes:"
  echo ""
  
  ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 << 'EOF'
    cd /opt/lopesul-dashboard
    cat > /tmp/monitor-pedidos.js << 'SCRIPT'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const pedidos = await prisma.pedido.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: { device: { select: { id: true, mikId: true } } },
  });
  
  console.log('\n📦 Últimos 3 pedidos:\n');
  pedidos.forEach((p, i) => {
    console.log(`${i+1}. Code: ${p.code} | Status: ${p.status}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   Device: ${p.device?.mikId || 'N/A'}`);
    console.log(`   IP: ${p.ip || 'N/A'} | MAC: ${p.deviceMac || 'N/A'}`);
    console.log(`   Criado: ${p.createdAt.toISOString()}\n`);
  });
  await prisma.$disconnect();
}
main();
SCRIPT
    node /tmp/monitor-pedidos.js
EOF
else
  echo "🔍 Monitorando pedido: $PEDIDO_CODE"
  echo ""
  
  ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 << EOF
    cd /opt/lopesul-dashboard
    
    echo "1️⃣ Verificando pedido no banco..."
    cat > /tmp/check-pedido-\$RANDOM.js << 'SCRIPT'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const pedido = await prisma.pedido.findFirst({
    where: { code: '$PEDIDO_CODE' },
    include: { 
      device: { select: { id: true, mikId: true } },
      SessaoAtiva: true,
    },
  });
  
  if (!pedido) {
    console.log('❌ Pedido não encontrado');
    return;
  }
  
  console.log('\n📦 Pedido:');
  console.log('   Code:', pedido.code);
  console.log('   Status:', pedido.status);
  console.log('   Device:', pedido.device?.mikId || 'N/A');
  console.log('   IP:', pedido.ip || 'N/A');
  console.log('   MAC:', pedido.deviceMac || 'N/A');
  console.log('   Tem sessão ativa:', pedido.SessaoAtiva.length > 0 ? 'SIM' : 'NÃO');
  if (pedido.SessaoAtiva.length > 0) {
    pedido.SessaoAtiva.forEach(s => {
      console.log('   Sessão:', s.id, '| Roteador:', s.roteadorId || 'N/A');
    });
  }
  await prisma.\$disconnect();
}
main();
SCRIPT
    node /tmp/check-pedido-*.js
    
    echo ""
    echo "2️⃣ Verificando logs do webhook..."
    pm2 logs 4 --lines 100 --nostream | grep -E "(webhook|$PEDIDO_CODE|liberarAcesso|Sessão ativa)" | tail -30
    
    echo ""
    echo "3️⃣ Verificando logs do relay..."
    pm2 logs mikrotik-relay --lines 50 --nostream | grep -E "(exec-by-pedido|$PEDIDO_CODE)" | tail -20
    
    echo ""
    echo "4️⃣ Verificando sessões ativas..."
    cat > /tmp/check-sessoes-\$RANDOM.js << 'SCRIPT'
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sessoes = await prisma.sessaoAtiva.findMany({
    where: { pedido: { code: '$PEDIDO_CODE' } },
    include: { pedido: { select: { code: true, status: true } } },
    orderBy: { inicioEm: 'desc' },
  });
  
  if (sessoes.length === 0) {
    console.log('❌ Nenhuma sessão ativa encontrada');
  } else {
    console.log('\n✅ Sessões ativas:');
    sessoes.forEach(s => {
      console.log('   IP:', s.ipCliente);
      console.log('   MAC:', s.macCliente || 'N/A');
      console.log('   Roteador:', s.roteadorId || 'N/A');
      console.log('   Criado:', s.inicioEm.toISOString());
      console.log('   Expira:', s.expiraEm.toISOString());
    });
  }
  await prisma.\$disconnect();
}
main();
SCRIPT
    node /tmp/check-sessoes-*.js
EOF
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Monitoramento concluído"
echo "═══════════════════════════════════════════════════════════════"

