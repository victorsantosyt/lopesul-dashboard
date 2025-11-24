#!/bin/bash
# Script para verificar e corrigir o redirect.html no Mikrotik
# Uso: bash check-mikrotik-redirect.sh [Mikrotik IP]

RELAY_USER="relay"
RELAY_PASS="api2025"
VPS_HOST="67.211.212.18"
VPS_USER="root"
MIKROTIK_IP="${1:-10.200.200.7}"

echo "🔍 Verificando configuração do redirect no Mikrotik $MIKROTIK_IP..."
echo ""

# Função para executar comando no Mikrotik via VPS
exec_mikrotik() {
    local cmd="$1"
    SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
    
    if [ -f "$SSH_KEY" ]; then
        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
            "$VPS_USER@$VPS_HOST" \
            "sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
            '$RELAY_USER@$MIKROTIK_IP' '$cmd'"
    else
        ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
            "$VPS_USER@$VPS_HOST" \
            "sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
            '$RELAY_USER@$MIKROTIK_IP' '$cmd'"
    fi
}

echo "1️⃣  Verificando arquivo redirect.html..."
exec_mikrotik "/file print where name~redirect"

echo ""
echo "2️⃣  Verificando configuração do hotspot profile..."
exec_mikrotik "/ip hotspot profile print"

echo ""
echo "3️⃣  Verificando configuração do hotspot server..."
exec_mikrotik "/ip hotspot print"

echo ""
echo "✅ Verificação concluída!"
echo ""
echo "💡 Para corrigir o redirect.html, execute:"
echo "   bash setup-mikrotik-hotspot.sh"

