#!/bin/bash
# Script para liberar acesso manual de um cliente

MAC="8A:22:3C:F4:F9:70"
IP="192.168.88.80"
PEDIDO_CODE="J0K9SDS80O"

echo "🔓 Liberando acesso manual para cliente:"
echo "   MAC: $MAC"
echo "   IP:  $IP"
echo "   Pedido: $PEDIDO_CODE"
echo ""

# Chamar API de liberar acesso
curl -X POST "https://cativo.lopesuldashboardwifi.com/api/liberar-acesso" \
  -H "Content-Type: application/json" \
  -d "{
    \"externalId\": \"$PEDIDO_CODE\",
    \"ip\": \"$IP\",
    \"mac\": \"$MAC\"
  }" | jq .

echo ""
echo "✅ Se retornou ok:true, o acesso foi liberado!"

