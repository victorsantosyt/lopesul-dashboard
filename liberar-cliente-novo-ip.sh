#!/bin/bash
# Script para liberar cliente com novo IP
# Uso: ./liberar-cliente-novo-ip.sh

echo "🔓 Liberando acesso para novo IP do cliente..."
echo ""

cd /opt/lopesul-dashboard
node liberar-cliente-simples.js 192.168.88.67 24:29:34:91:1A:18 KPN2TGTO8Z

