#!/bin/bash
# Script rápido para verificar cliente no servidor

MAC="8A:22:3C:F4:F9:70"
IP="192.168.88.80"

echo "🔍 Verificando cliente: MAC=$MAC, IP=$IP"
echo ""

# Executar no servidor
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 << EOF
cd /opt/lopesul-dashboard

# Tentar usar endpoint de debug primeiro (após deploy)
echo "📋 Testando endpoint de debug..."
curl -s "http://localhost:3000/api/debug/verificar-cliente?mac=${MAC}&ip=${IP}" 2>/dev/null | jq . 2>/dev/null || echo "   ⚠️  Endpoint ainda não disponível"

echo ""
echo "💡 Se o endpoint não funcionar, execute manualmente no servidor:"
echo "   cd /opt/lopesul-dashboard"
echo "   node verificar-cliente-especifico.js"
EOF

