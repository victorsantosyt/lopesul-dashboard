#!/bin/bash

# Script para testar pagamento completo com MAC e IP
# Simula o fluxo completo: criar pedido com MAC/IP → pagar → webhook libera

API="https://painel.lopesuldashboardwifi.com"
MAC="AA:BB:CC:DD:EE:11"
IP="192.168.88.100"

echo "🧪 Teste de Pagamento com MAC e IP"
echo "===================================="
echo ""
echo "1️⃣  Criando pedido Pix com MAC/IP..."

RESPONSE=$(curl -s -X POST "$API/api/pagamentos/checkout" \
  -H "Content-Type: application/json" \
  -d "{
    \"valor\": 14.90,
    \"descricao\": \"Teste Acesso 24h\",
    \"clienteIp\": \"$IP\",
    \"clienteMac\": \"$MAC\",
    \"customer\": {
      \"name\": \"Cliente Teste\",
      \"document\": \"12345678901\"
    }
  }")

echo "$RESPONSE" | jq '.'

ORDER_ID=$(echo "$RESPONSE" | jq -r '.externalId')
QR_CODE=$(echo "$RESPONSE" | jq -r '.copiaECola')

if [ "$ORDER_ID" = "null" ] || [ -z "$ORDER_ID" ]; then
  echo ""
  echo "❌ Erro ao criar pedido!"
  exit 1
fi

echo ""
echo "✅ Pedido criado: $ORDER_ID"
echo "📱 QR Code: ${QR_CODE:0:50}..."
echo ""
echo "2️⃣  Agora PAGUE o Pix usando seu celular"
echo ""
echo "3️⃣  Aguardando webhook do Pagar.me..."
echo ""
echo "💡 Monitore os logs:"
echo "   ssh root@67.211.212.18 'pm2 logs lopesul-painel | grep -E \"(liberarClienteNoMikrotik|webhook)\"'"
echo ""
echo "4️⃣  Após pagar, verifique se o usuário foi criado no MikroTik:"
echo "   ssh root@67.211.212.18 'ssh -p 2222 admin@localhost \"/ip hotspot user print where name=user-AABBCCDDEE11\"'"
echo ""
echo "5️⃣  Verifique se a sessão ativa foi criada:"
echo "   ssh root@67.211.212.18 'ssh -p 2222 admin@localhost \"/ip hotspot active print where mac-address=$MAC\"'"
