#!/bin/bash
# Script para verificar cliente no servidor

MAC="8A:22:3C:F4:F9:70"
IP="192.168.88.80"

echo "🔍 Verificando cliente:"
echo "   MAC: $MAC"
echo "   IP:  $IP"
echo ""

cd /opt/lopesul-dashboard

# Verificar via API local se disponível
echo "📋 Testando endpoint de debug..."
curl -s "http://localhost:3000/api/debug/verificar-cliente?mac=${MAC}&ip=${IP}" | jq . 2>/dev/null || echo "   ⚠️  Endpoint ainda não disponível (precisa deploy)"

echo ""
echo "💡 Para verificar completamente, execute no servidor:"
echo "   node verificar-cliente-especifico.js"
