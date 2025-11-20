#!/bin/bash
# Script rápido para liberar cliente manualmente
# Uso: ./liberar-cliente-rapido.sh <IP> <MAC> [pedidoCode]

IP=${1:-"192.168.88.68"}
MAC=${2:-"24:29:34:91:1A:18"}
PEDIDO=${3:-"KPN2TGTO8Z"}

echo "🔓 Liberando acesso para cliente..."
echo "   IP: $IP"
echo "   MAC: $MAC"
echo "   Pedido: $PEDIDO"
echo ""

cd /opt/lopesul-dashboard
node liberar-cliente-manual.js "$IP" "$MAC" "$PEDIDO"

