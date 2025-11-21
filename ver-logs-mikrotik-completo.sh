#!/bin/bash
# Script para ver logs completos do Mikrotik
# Uso: ./ver-logs-mikrotik-completo.sh [Mikrotik IP]
# Exemplo: ./ver-logs-mikrotik-completo.sh 10.200.200.7

MIKROTIK_IP="${1:-10.200.200.7}"
VPS_HOST="67.211.212.18"
VPS_USER="root"
RELAY_USER="relay"
RELAY_PASS="api2025"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"

echo "🔍 Verificando logs e status do Mikrotik $MIKROTIK_IP..."
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
        '$RELAY_USER@$MIKROTIK_IP' '$cmd'" 2>/dev/null
  else
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$VPS_USER@$VPS_HOST" \
        "sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        '$RELAY_USER@$MIKROTIK_IP' '$cmd'" 2>/dev/null
  fi
  
  echo ""
}

# 1. Sessões ativas do hotspot
exec_mikrotik "/ip/hotspot/active/print detail" "1️⃣ SESSÕES ATIVAS DO HOTSPOT"

# 2. Clientes na lista paid_clients
exec_mikrotik "/ip/firewall/address-list/print where list=paid_clients" "2️⃣ CLIENTES PAGOS (paid_clients)"

# 3. IP Bindings (bypassed)
exec_mikrotik "/ip/hotspot/ip-binding/print where type=bypassed" "3️⃣ IP BINDINGS (BYPASSED)"

# 4. Logs do sistema (últimas 20 linhas)
exec_mikrotik "/log/print where topics~\"hotspot\" or topics~\"info\" or topics~\"warning\" or topics~\"error\" follow=no" "4️⃣ LOGS DO SISTEMA (Hotspot/Info/Warning/Error)"

# 5. Tentativas de login recentes (últimas 10)
exec_mikrotik "/log/print where topics~\"hotspot\" and message~\"login\" follow=no" "5️⃣ TENTATIVAS DE LOGIN RECENTES"

# 6. Usuários do hotspot
exec_mikrotik "/ip/hotspot/user/print" "6️⃣ USUÁRIOS DO HOTSPOT"

# 7. Status do hotspot
exec_mikrotik "/ip/hotspot/print" "7️⃣ STATUS DO HOTSPOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Verificação completa!"
echo ""
echo "💡 Dica: Para monitorar em tempo real, use:"
echo "   ./monitorar-mikrotik-tempo-real.sh"

