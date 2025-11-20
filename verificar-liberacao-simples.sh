#!/bin/bash
# Script simples para verificar liberação (usa API do relay)
# Uso: ./verificar-liberacao-simples.sh <IP> <MAC> <PEDIDO_CODE>

IP=${1:-"192.168.88.78"}
MAC=${2:-"DE:13:6F:8F:D5:07"}
PEDIDO_CODE=${3:-"KPN2TGTO8Z"}
MIKROTIK="10.200.200.7"

echo "🔍 Verificação de Liberação"
echo "============================"
echo "   IP: $IP"
echo "   MAC: $MAC"
echo "   Pedido: $PEDIDO_CODE"
echo ""

cd /opt/lopesul-dashboard

# 1. Verificar no banco
echo "1️⃣ Verificando no banco de dados..."
node << 'NODE_SCRIPT'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const pedidoCode = process.argv[2];
    const ip = process.argv[3];
    const mac = process.argv[4];
    
    const pedido = await prisma.pedido.findFirst({
      where: { code: pedidoCode },
      include: { SessaoAtiva: { where: { ativo: true } } }
    });
    
    if (pedido) {
      console.log('   ✅ Pedido:', pedido.code, 'Status:', pedido.status);
      console.log('   IP no pedido:', pedido.ip, 'MAC:', pedido.deviceMac);
      console.log('   Sessões ativas:', pedido.SessaoAtiva.length);
    } else {
      console.log('   ❌ Pedido não encontrado');
    }
    
    const sessoes = await prisma.sessaoAtiva.findMany({
      where: {
        OR: [
          { ipCliente: ip },
          { macCliente: mac }
        ],
        ativo: true
      }
    });
    
    if (sessoes.length > 0) {
      console.log('   ✅ Sessões ativas encontradas:', sessoes.length);
      sessoes.forEach(s => {
        console.log('      - IP:', s.ipCliente, 'MAC:', s.macCliente);
      });
    }
    
    // Verificar outros IPs para o mesmo MAC
    const outrosPedidos = await prisma.pedido.findMany({
      where: {
        deviceMac: mac,
        status: 'PAID',
        createdAt: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    if (outrosPedidos.length > 0) {
      console.log('   📋 Outros IPs para este MAC (últimas 3h):');
      outrosPedidos.forEach(p => {
        console.log('      - IP:', p.ip, 'Code:', p.code);
      });
    }
  } catch (err) {
    console.error('   ❌ Erro:', err.message);
  } finally {
    await prisma.$disconnect();
  }
})();
NODE_SCRIPT
"$PEDIDO_CODE" "$IP" "$MAC" 2>/dev/null

echo ""

# 2. Verificar no Mikrotik via relay API
echo "2️⃣ Verificando no Mikrotik (via relay API)..."
echo ""

# Verificar paid_clients
echo "   📋 Lista paid_clients:"
curl -s -X POST http://localhost:3001/relay/exec \
  -H "Content-Type: application/json" \
  -d "{
    \"host\": \"$MIKROTIK\",
    \"user\": \"relay\",
    \"pass\": \"api2025\",
    \"command\": \"/ip/firewall/address-list/print where list=paid_clients and address=$IP\"
  }" 2>/dev/null | grep -q "$IP" && echo "      ✅ IP encontrado" || echo "      ❌ IP NÃO encontrado"

# Verificar ip-binding
echo "   📋 IP Binding:"
BINDING=$(curl -s -X POST http://localhost:3001/relay/exec \
  -H "Content-Type: application/json" \
  -d "{
    \"host\": \"$MIKROTIK\",
    \"user\": \"relay\",
    \"pass\": \"api2025\",
    \"command\": \"/ip/hotspot/ip-binding/print where address=$IP or mac-address=$MAC\"
  }" 2>/dev/null)

if echo "$BINDING" | grep -q "$IP\|$MAC"; then
  echo "      ✅ IP binding encontrado"
  echo "$BINDING" | grep -E "address|mac-address|type" | head -3 | sed 's/^/         /'
else
  echo "      ❌ IP binding NÃO encontrado"
fi

# Verificar sessão ativa
echo "   📋 Sessão Ativa:"
ACTIVE=$(curl -s -X POST http://localhost:3001/relay/exec \
  -H "Content-Type: application/json" \
  -d "{
    \"host\": \"$MIKROTIK\",
    \"user\": \"relay\",
    \"pass\": \"api2025\",
    \"command\": \"/ip/hotspot/active/print where address=$IP or mac-address=$MAC\"
  }" 2>/dev/null)

if echo "$ACTIVE" | grep -q "$IP\|$MAC"; then
  echo "      ✅ Sessão ativa encontrada"
  echo "$ACTIVE" | grep -E "address|mac-address|user" | head -3 | sed 's/^/         /'
else
  echo "      ❌ Sessão ativa NÃO encontrada"
fi

echo ""
echo "✅ Verificação concluída!"
echo ""
echo "💡 Se o cliente ainda não consegue acessar:"
echo "   1. O IP pode ter mudado (verifique 'Outros IPs' acima)"
echo "   2. Libere o novo IP: ./forcar-autenticacao-via-api.sh <NOVO_IP> $MAC $PEDIDO_CODE"
echo "   3. O cliente precisa fazer uma nova requisição HTTP"

