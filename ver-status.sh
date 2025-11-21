#!/bin/bash
# Script rápido para ver status do sistema
# Uso: ./ver-status.sh

cd /opt/lopesul-dashboard 2>/dev/null || cd "$(dirname "$0")" || exit 1

echo "🔍 Verificando status do sistema..."
echo ""

node status-sistema-completo.js

