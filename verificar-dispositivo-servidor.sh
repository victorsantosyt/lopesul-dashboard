#!/bin/bash
# Script para verificar dispositivos no servidor

echo "🔍 Verificando dispositivos no banco de dados do servidor..."
echo ""

ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'cd /opt/lopesul-dashboard && node verificar-dispositivos.js'

