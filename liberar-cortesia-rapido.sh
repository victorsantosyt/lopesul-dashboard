#!/bin/bash
# Script rápido para liberar acesso de cortesia

MAC="8A:22:3C:F4:F9:70"
IP="192.168.88.80"

echo "🔓 Liberando acesso de cortesia:"
echo "   MAC: $MAC"
echo "   IP:  $IP"
echo ""

# Chamar API de liberar acesso de cortesia
curl -X POST "https://cativo.lopesuldashboardwifi.com/api/liberar-acesso" \
  -H "Content-Type: application/json" \
  -d "{
    \"ip\": \"$IP\",
    \"mac\": \"$MAC\",
    \"externalId\": \"CORTESIA-$(date +%s)\",
    \"description\": \"Acesso de Cortesia\"
  }" | jq .

echo ""
echo "✅ Se retornou ok:true, o acesso foi liberado!"
