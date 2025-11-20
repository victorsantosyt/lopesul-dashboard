#!/bin/bash
# Script para forçar autenticação via API do relay
# Uso: ./forcar-autenticacao-via-api.sh <IP> <MAC>

IP=${1:-"192.168.88.67"}
MAC=${2:-"24:29:34:91:1A:18"}

echo "🔓 Forçando autenticação via API..."
echo "   IP: $IP"
echo "   MAC: $MAC"
echo ""

# Usar a API REST que já existe
cd /opt/lopesul-dashboard

echo "📡 Chamando API /api/liberar-acesso..."
curl -X POST http://localhost:3000/api/liberar-acesso \
  -H "Content-Type: application/json" \
  -d "{
    \"externalId\": \"KPN2TGTO8Z\",
    \"ip\": \"$IP\",
    \"mac\": \"$MAC\"
  }" 2>/dev/null | jq '.' 2>/dev/null || cat

echo ""
echo "✅ Processo concluído!"

