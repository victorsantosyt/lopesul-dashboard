#!/bin/bash
# Script completo para verificar liberação de cliente
# Uso: ./verificar-liberacao-cliente.sh <IP> <MAC> <PEDIDO_CODE>

IP=${1:-"192.168.88.78"}
MAC=${2:-"DE:13:6F:8F:D5:07"}
PEDIDO_CODE=${3:-"KPN2TGTO8Z"}
MIKROTIK="10.200.200.7"

echo "🔍 Verificação Completa de Liberação"
echo "====================================="
echo "   IP: $IP"
echo "   MAC: $MAC"
echo "   Pedido: $PEDIDO_CODE"
echo "   Mikrotik: $MIKROTIK"
echo ""

cd /opt/lopesul-dashboard

# 1. Verificar no banco de dados
echo "1️⃣ Verificando no banco de dados..."
node -e "
import('@prisma/client').then(async ({ PrismaClient }) => {
  const prisma = new PrismaClient();
  try {
    const pedido = await prisma.pedido.findFirst({
      where: { code: '$PEDIDO_CODE' },
      include: { SessaoAtiva: { where: { ativo: true } } }
    });
    if (pedido) {
      console.log('   ✅ Pedido encontrado:', pedido.code);
      console.log('   Status:', pedido.status);
      console.log('   IP no pedido:', pedido.ip);
      console.log('   MAC no pedido:', pedido.deviceMac);
      console.log('   Sessões ativas:', pedido.SessaoAtiva.length);
      if (pedido.SessaoAtiva.length > 0) {
        pedido.SessaoAtiva.forEach(s => {
          console.log('      - IP:', s.ipCliente, 'MAC:', s.macCliente, 'Expira:', s.expiraEm);
        });
      }
    } else {
      console.log('   ❌ Pedido não encontrado');
    }
    
    const sessoes = await prisma.sessaoAtiva.findMany({
      where: {
        OR: [
          { ipCliente: '$IP' },
          { macCliente: '$MAC' }
        ],
        ativo: true
      }
    });
    if (sessoes.length > 0) {
      console.log('   ✅ Sessões ativas encontradas:', sessoes.length);
      sessoes.forEach(s => {
        console.log('      - IP:', s.ipCliente, 'MAC:', s.macCliente, 'Expira:', s.expiraEm);
      });
    } else {
      console.log('   ⚠️  Nenhuma sessão ativa encontrada para IP/MAC');
    }
  } catch (err) {
    console.error('   ❌ Erro:', err.message);
  } finally {
    await prisma.\$disconnect();
  }
});
" 2>/dev/null || echo "   ⚠️  Erro ao verificar banco (pode ser problema de import)"

echo ""

# 2. Verificar no Mikrotik via API do relay
echo "2️⃣ Verificando no Mikrotik (via relay)..."
echo "   (Se sshpass não estiver instalado, pode falhar)"
echo ""

# Tentar via relay API
RELAY_RESPONSE=$(curl -s -X POST http://localhost:3001/relay/exec \
  -H "Content-Type: application/json" \
  -d "{
    \"host\": \"$MIKROTIK\",
    \"user\": \"relay\",
    \"pass\": \"api2025\",
    \"command\": \"/ip/firewall/address-list/print where list=paid_clients and address=$IP\"
  }" 2>/dev/null)

if echo "$RELAY_RESPONSE" | grep -q "$IP"; then
  echo "   ✅ IP está na lista paid_clients"
else
  echo "   ❌ IP NÃO está na lista paid_clients"
fi

# Verificar ip-binding
BINDING_RESPONSE=$(curl -s -X POST http://localhost:3001/relay/exec \
  -H "Content-Type: application/json" \
  -d "{
    \"host\": \"$MIKROTIK\",
    \"user\": \"relay\",
    \"pass\": \"api2025\",
    \"command\": \"/ip/hotspot/ip-binding/print where address=$IP or mac-address=$MAC\"
  }" 2>/dev/null)

if echo "$BINDING_RESPONSE" | grep -q "$IP\|$MAC"; then
  echo "   ✅ IP binding encontrado"
else
  echo "   ❌ IP binding NÃO encontrado"
fi

# Verificar sessão ativa
ACTIVE_RESPONSE=$(curl -s -X POST http://localhost:3001/relay/exec \
  -H "Content-Type: application/json" \
  -d "{
    \"host\": \"$MIKROTIK\",
    \"user\": \"relay\",
    \"pass\": \"api2025\",
    \"command\": \"/ip/hotspot/active/print where address=$IP or mac-address=$MAC\"
  }" 2>/dev/null)

if echo "$ACTIVE_RESPONSE" | grep -q "$IP\|$MAC"; then
  echo "   ✅ Sessão ativa encontrada no hotspot"
  echo "$ACTIVE_RESPONSE" | grep -E "address|mac-address|user" | head -5
else
  echo "   ❌ Sessão ativa NÃO encontrada no hotspot"
fi

echo ""

# 3. Verificar se há outros IPs para o mesmo MAC
echo "3️⃣ Verificando outros IPs para o mesmo MAC..."
node -e "
import('@prisma/client').then(async ({ PrismaClient }) => {
  const prisma = new PrismaClient();
  try {
    const pedidos = await prisma.pedido.findMany({
      where: {
        deviceMac: '$MAC',
        status: 'PAID',
        createdAt: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    if (pedidos.length > 0) {
      console.log('   📋 Pedidos pagos com este MAC (últimas 3h):');
      pedidos.forEach(p => {
        console.log('      - IP:', p.ip, 'Code:', p.code, 'Criado:', p.createdAt.toISOString());
      });
    }
    
    const sessoes = await prisma.sessaoAtiva.findMany({
      where: {
        macCliente: '$MAC',
        ativo: true
      }
    });
    if (sessoes.length > 0) {
      console.log('   📋 Sessões ativas com este MAC:');
      sessoes.forEach(s => {
        console.log('      - IP:', s.ipCliente, 'Expira:', s.expiraEm.toISOString());
      });
    }
  } catch (err) {
    console.error('   ❌ Erro:', err.message);
  } finally {
    await prisma.\$disconnect();
  }
});
" 2>/dev/null || echo "   ⚠️  Erro ao verificar banco"

echo ""
echo "✅ Verificação concluída!"
echo ""
echo "💡 Se o cliente ainda não consegue acessar:"
echo "   1. O IP pode ter mudado novamente (verifique outros IPs acima)"
echo "   2. O cliente precisa fazer uma nova requisição HTTP"
echo "   3. Pode ser necessário liberar o novo IP manualmente"

