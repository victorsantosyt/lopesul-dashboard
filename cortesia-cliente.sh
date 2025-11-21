#!/bin/bash
# Script para dar acesso de cortesia executando remotamente no servidor

MAC="8A:22:3C:F4:F9:70"
IP="192.168.88.80"

echo "🔓 Dando acesso de cortesia:"
echo "   MAC: $MAC"
echo "   IP:  $IP"
echo ""

echo "📡 Conectando ao servidor e executando script de cortesia..."
echo ""

# Executar no servidor
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 << EOF
cd /opt/lopesul-dashboard
node liberar-cliente-cortesia.js $IP $MAC
EOF

echo ""
echo "✅ Concluído!"

