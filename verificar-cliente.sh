#!/bin/bash
# Script simples para verificar status de cliente
# Uso: ./verificar-cliente.sh [IP] [MAC]

IP=${1:-"192.168.88.67"}
MAC=${2:-"24:29:34:91:1A:18"}

echo "🔍 Verificando cliente: IP=$IP, MAC=$MAC"
echo ""

# Verificar no banco de dados
echo "📊 Verificando no banco de dados..."
cd /opt/lopesul-dashboard

# Criar script temporário no diretório do projeto
cat > verificar-cliente-temp.mjs << 'EOFSCRIPT'
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const IP = process.argv[2] || '192.168.88.67';
const MAC = process.argv[3] || '24:29:34:91:1A:18';

async function main() {
  console.log('\n1️⃣ PEDIDOS:');
  const pedidos = await prisma.pedido.findMany({
    where: {
      OR: [
        { ip: IP },
        { deviceMac: MAC },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (pedidos.length === 0) {
    console.log('   ❌ Nenhum pedido encontrado');
  } else {
    pedidos.forEach(p => {
      const status = p.status === 'PAID' ? '✅' : '⏳';
      console.log(`   ${status} Code: ${p.code}, Status: ${p.status}, IP: ${p.ip || 'N/A'}, MAC: ${p.deviceMac || 'N/A'}, Criado: ${p.createdAt.toISOString()}`);
    });
  }

  console.log('\n2️⃣ SESSÕES ATIVAS:');
  const sessoes = await prisma.sessaoAtiva.findMany({
    where: {
      OR: [
        { ipCliente: IP },
        { macCliente: MAC },
      ],
      ativo: true,
    },
    orderBy: { expiraEm: 'desc' },
  });

  if (sessoes.length === 0) {
    console.log('   ❌ Nenhuma sessão ativa encontrada');
  } else {
    sessoes.forEach(s => {
      const agora = new Date();
      const expirado = s.expiraEm < agora;
      const status = expirado ? '❌ EXPIRADA' : '✅ ATIVA';
      console.log(`   ${status} IP: ${s.ipCliente}, MAC: ${s.macCliente || 'N/A'}, Expira: ${s.expiraEm.toISOString()}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
EOFSCRIPT

node verificar-cliente-temp.mjs "$IP" "$MAC"
rm -f verificar-cliente-temp.mjs

echo ""
echo "📡 Verificando no Mikrotik (10.200.200.7)..."
echo ""

# Verificar se IP está na lista paid_clients
echo "3️⃣ Lista 'paid_clients':"
PAID_CLIENTS=$(sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 relay@10.200.200.7 \
  "/ip/firewall/address-list/print where list=paid_clients" 2>/dev/null)

if echo "$PAID_CLIENTS" | grep -q "$IP"; then
  echo "   ✅ IP $IP está na lista paid_clients"
  echo "$PAID_CLIENTS" | grep "$IP" | head -1 | sed 's/^/      /'
else
  echo "   ❌ IP $IP NÃO está na lista paid_clients"
  echo "   💡 Listando IPs liberados próximos:"
  echo "$PAID_CLIENTS" | grep "192.168.88" | head -5 | sed 's/^/      /'
fi

echo ""

# Verificar IP binding
echo "4️⃣ IP Binding no Hotspot:"
BINDING=$(sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 relay@10.200.200.7 \
  "/ip/hotspot/ip-binding/print where address=$IP" 2>/dev/null)

if [ -n "$BINDING" ] && [ "$BINDING" != "" ]; then
  echo "   ✅ IP binding encontrado:"
  echo "$BINDING" | head -3 | sed 's/^/      /'
else
  echo "   ❌ IP binding NÃO encontrado"
fi

echo ""

# Verificar sessões ativas no hotspot
echo "5️⃣ Sessões Ativas no Hotspot:"
ATIVAS=$(sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 relay@10.200.200.7 \
  "/ip/hotspot/active/print where address=$IP or mac-address=$MAC" 2>/dev/null)

if [ -n "$ATIVAS" ] && [ "$ATIVAS" != "" ]; then
  echo "   ✅ Sessão ativa encontrada:"
  echo "$ATIVAS" | head -5 | sed 's/^/      /'
else
  echo "   ❌ Nenhuma sessão ativa encontrada no hotspot"
  echo "   💡 Cliente pode ter desconectado ou IP/MAC mudou"
  echo ""
  echo "   📋 Últimas sessões ativas (últimas 5):"
  sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 relay@10.200.200.7 \
    "/ip/hotspot/active/print" 2>/dev/null | tail -5 | sed 's/^/      /'
fi

echo ""
echo "📋 RESUMO:"
echo "   Se o cliente não aparecer, pode ser que:"
echo "   - Cliente desconectou do Wi-Fi"
echo "   - IP mudou novamente (DHCP)"
echo "   - MAC mudou (privacidade)"
echo "   - Cliente está em outro ônibus"
