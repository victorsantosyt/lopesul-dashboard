#!/bin/bash
# Script para dar acesso de cortesia via API (cria pedido temporário primeiro)

MAC="8A:22:3C:F4:F9:70"
IP="192.168.88.80"

echo "🔓 Liberando acesso de cortesia:"
echo "   MAC: $MAC"
echo "   IP:  $IP"
echo ""

# Criar um código único para o pedido de cortesia
PEDIDO_CODE="CORTESIA-$(date +%s)"

echo "📝 Criando pedido de cortesia temporário..."
echo "   Code: $PEDIDO_CODE"
echo ""

# Primeiro, criar um pedido via endpoint (se existir) ou usar o script
# Como não temos endpoint para criar pedido de cortesia, vamos usar o script no servidor
# Mas por enquanto, vamos tentar criar manualmente via API se possível

# Para executar no servidor, você pode usar:
echo "💡 Execute no servidor:"
echo ""
echo "ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'cd /opt/lopesul-dashboard && node liberar-cliente-cortesia.js $IP $MAC'"
echo ""
echo "Ou conecte-se ao servidor e execute:"
echo "cd /opt/lopesul-dashboard"
echo "node liberar-cliente-cortesia.js $IP $MAC"

