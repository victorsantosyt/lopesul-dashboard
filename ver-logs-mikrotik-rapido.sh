#!/bin/bash
# Script RÁPIDO para ver apenas o essencial do Mikrotik
# Uso: ./ver-logs-mikrotik-rapido.sh [Mikrotik IP]
# Exemplo: ./ver-logs-mikrotik-rapido.sh 10.200.200.7

MIKROTIK_IP="${1:-10.200.200.7}"
VPS_HOST="67.211.212.18"
VPS_USER="root"
RELAY_USER="relay"
RELAY_PASS="api2025"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"

echo "🔍 Verificação rápida do Mikrotik $MIKROTIK_IP..."
echo ""

# Função para executar comando no Mikrotik
exec_mikrotik() {
  local cmd="$1"
  local desc="$2"
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 $desc"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if [ -f "$SSH_KEY" ]; then
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$VPS_USER@$VPS_HOST" \
        "sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        '$RELAY_USER@$MIKROTIK_IP' '$cmd'" 2>/dev/null | head -20
  else
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$VPS_USER@$VPS_HOST" \
        "sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        '$RELAY_USER@$MIKROTIK_IP' '$cmd'" 2>/dev/null | head -20
  fi
  
  echo ""
}

# 1. Sessões ativas do hotspot (apenas as últimas 10)
exec_mikrotik "/ip/hotspot/active/print detail" "1️⃣ SESSÕES ATIVAS DO HOTSPOT (últimas 10)"

# 2. Clientes na lista paid_clients
exec_mikrotik "/ip/firewall/address-list/print where list=paid_clients" "2️⃣ CLIENTES PAGOS (paid_clients)"

# 3. Logs recentes do hotspot (últimas 15)
exec_mikrotik "/log/print where topics~\"hotspot\" follow=no" "3️⃣ LOGS RECENTES DO HOTSPOT (últimas 15)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Verificação rápida concluída!"
echo ""
echo "💡 Para ver mais detalhes, use: ./ver-logs-mikrotik-completo.sh"

