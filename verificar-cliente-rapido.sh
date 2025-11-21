#!/bin/bash
# Script rápido para verificar cliente do Pagar.me
# Uso: ./verificar-cliente-rapido.sh J0K9SDS80O

PEDIDO_CODE="${1:-J0K9SDS80O}"

echo "🔍 Verificando cliente: $PEDIDO_CODE"
echo ""

cd /opt/lopesul-dashboard || exit 1

# Verificar via API
echo "📡 Consultando API..."
RESPONSE=$(curl -s "https://painel.lopesuldashboardwifi.com/api/pagamentos?q=${PEDIDO_CODE}&limit=1")

if echo "$RESPONSE" | jq -e '.itens[0]' > /dev/null 2>&1; then
  PEDIDO=$(echo "$RESPONSE" | jq '.itens[0]')
  echo "✅ Pedido encontrado:"
  echo "$RESPONSE" | jq -r '.itens[0] | "   Code: \(.code)\n   Status: \(.status)\n   Valor: R$ \(.valor)\n   IP: \(.ip // "N/A")\n   MAC: \(.mac // "N/A")\n   Data: \(.data)"'
  
  IP=$(echo "$RESPONSE" | jq -r '.itens[0].ip // empty')
  MAC=$(echo "$RESPONSE" | jq -r '.itens[0].mac // empty')
  
  if [ -n "$IP" ] || [ -n "$MAC" ]; then
    echo ""
    echo "🔍 Verificando sessão ativa..."
    PARAMS=""
    [ -n "$IP" ] && PARAMS="ip=${IP}"
    [ -n "$MAC" ] && PARAMS="${PARAMS}${PARAMS:+&}mac=${MAC}"
    
    SESSOES=$(curl -s "https://painel.lopesuldashboardwifi.com/api/sessoes?ativas=true&limit=10")
    if echo "$SESSOES" | jq -e '.[] | select(.ipCliente == "'"$IP"'")' > /dev/null 2>&1; then
      echo "✅ Sessão ativa encontrada!"
      echo "$SESSOES" | jq -r '.[] | select(.ipCliente == "'"$IP"'") | "   IP: \(.ipCliente)\n   MAC: \(.macCliente // "N/A")\n   Plano: \(.plano)\n   Expira: \(.expiraEm)"'
    else
      echo "❌ Nenhuma sessão ativa encontrada para este IP/MAC"
    fi
  fi
else
  echo "❌ Pedido não encontrado na API"
fi

echo ""
echo "💡 Para verificação completa, execute:"
echo "   node verificar-cliente-pagarme.js"
