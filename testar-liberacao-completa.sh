#!/bin/bash
# Script para testar liberação completa (paid_clients + ip-binding + sessão ativa)
# Uso: ./testar-liberacao-completa.sh <IP> <MAC> <PEDIDO_CODE>

IP=${1:-"192.168.88.78"}
MAC=${2:-"DE:13:6F:8F:D5:07"}
PEDIDO_CODE=${3:-"KPN2TGTO8Z"}

echo "🧪 Testando liberação completa..."
echo "   IP: $IP"
echo "   MAC: $MAC"
echo "   Pedido: $PEDIDO_CODE"
echo ""

cd /opt/lopesul-dashboard

echo "1️⃣ Liberando acesso via API..."
curl -X POST http://localhost:3000/api/liberar-acesso \
  -H "Content-Type: application/json" \
  -d "{
    \"externalId\": \"$PEDIDO_CODE\",
    \"ip\": \"$IP\",
    \"mac\": \"$MAC\"
  }" 2>/dev/null | jq '.' 2>/dev/null || cat

echo ""
echo ""
echo "2️⃣ Aguardando 2 segundos..."
sleep 2

echo ""
echo "3️⃣ Verificando sessão ativa no Mikrotik..."
echo "   (Execute manualmente no Mikrotik: /ip/hotspot/active/print where address=$IP)"
echo ""
echo "✅ Teste concluído!"
echo ""
echo "💡 Se o cliente ainda não consegue acessar:"
echo "   1. Verifique se o IP está na lista paid_clients"
echo "   2. Verifique se há ip-binding para o IP/MAC"
echo "   3. Verifique se há sessão ativa no hotspot"
echo "   4. O cliente pode precisar fazer uma nova requisição HTTP"

