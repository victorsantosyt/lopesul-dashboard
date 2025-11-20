#!/bin/bash
# Liberar cliente para o IP atual
# Uso: ./liberar-cliente-ip-atual.sh <IP_ATUAL> [MAC] [PEDIDO_CODE]

IP_ATUAL=${1:-"192.168.88.67"}
MAC=${2:-"24:29:34:91:1A:18"}
PEDIDO=${3:-"KPN2TGTO8Z"}

echo "🔓 Liberando acesso para IP atual: $IP_ATUAL"
echo "   MAC: $MAC"
echo "   Pedido: $PEDIDO"
echo ""

cd /opt/lopesul-dashboard
node liberar-cliente-simples.js "$IP_ATUAL" "$MAC" "$PEDIDO"

