#!/bin/bash
# Script para verificar se cliente tem acesso configurado no Mikrotik
# Uso: ./verificar-acesso-cliente.sh <IP> <MAC>

IP=${1:-"192.168.88.70"}
MAC=${2:-"CE:79:0D:CF:EA:D6"}
MIKROTIK="10.200.200.7"

echo "🔍 Verificando acesso do cliente no Mikrotik..."
echo "   IP: $IP"
echo "   MAC: $MAC"
echo "   Mikrotik: $MIKROTIK"
echo ""

cd /opt/lopesul-dashboard

# Verificar via relay API
echo "1️⃣ Verificando lista paid_clients:"
PAID=$(curl -s -X POST http://localhost:3001/relay/exec \
  -H "Content-Type: application/json" \
  -d "{
    \"host\": \"$MIKROTIK\",
    \"user\": \"relay\",
    \"pass\": \"api2025\",
    \"command\": \"/ip/firewall/address-list/print where list=paid_clients and address=$IP\"
  }" 2>/dev/null)

if echo "$PAID" | grep -q "$IP"; then
  echo "   ✅ IP está na lista paid_clients"
  echo "$PAID" | grep "$IP" | head -1 | sed 's/^/      /'
else
  echo "   ❌ IP NÃO está na lista paid_clients"
fi

echo ""
echo "2️⃣ Verificando IP binding:"
BINDING=$(curl -s -X POST http://localhost:3001/relay/exec \
  -H "Content-Type: application/json" \
  -d "{
    \"host\": \"$MIKROTIK\",
    \"user\": \"relay\",
    \"pass\": \"api2025\",
    \"command\": \"/ip/hotspot/ip-binding/print where address=$IP or mac-address=$MAC\"
  }" 2>/dev/null)

if echo "$BINDING" | grep -q "$IP\|$MAC"; then
  echo "   ✅ IP binding encontrado"
  echo "$BINDING" | grep -E "address|mac-address|type" | head -3 | sed 's/^/      /'
else
  echo "   ❌ IP binding NÃO encontrado"
fi

echo ""
echo "3️⃣ Verificando sessão ativa:"
ACTIVE=$(curl -s -X POST http://localhost:3001/relay/exec \
  -H "Content-Type: application/json" \
  -d "{
    \"host\": \"$MIKROTIK\",
    \"user\": \"relay\",
    \"pass\": \"api2025\",
    \"command\": \"/ip/hotspot/active/print where address=$IP or mac-address=$MAC\"
  }" 2>/dev/null)

if echo "$ACTIVE" | grep -q "$IP\|$MAC"; then
  echo "   ✅ Sessão ativa encontrada"
  echo "$ACTIVE" | grep -E "address|mac-address|user" | head -3 | sed 's/^/      /'
else
  echo "   ⚠️  Nenhuma sessão ativa (pode ser normal se ip-binding está configurado)"
fi

echo ""
echo "✅ Verificação concluída!"
echo ""
echo "💡 Se o cliente está com conexão mas não aparece aqui:"
echo "   1. O ip-binding pode estar funcionando mesmo com erros de timeout"
echo "   2. O cliente pode precisar fazer uma nova requisição HTTP"
echo "   3. Pode haver um ip-binding antigo que ainda está ativo"

