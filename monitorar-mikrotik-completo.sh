#!/bin/bash
# Script COMPLETO para monitorar Mikrotik em tempo real
# Mostra: Dashboard + Relay + Estatísticas
# Uso: ./monitorar-mikrotik-completo.sh

echo "🔍 Monitoramento COMPLETO do Mikrotik"
echo "📊 Dashboard + Relay + Estatísticas"
echo ""
echo "💡 Dica: Use Ctrl+C para parar"
echo ""

# Verificar se está no servidor
if [ -f "/opt/lopesul-dashboard/package.json" ]; then
  SSH_CMD=""
  PM2_ID="4"
  RELAY_NAME="mikrotik-relay"
else
  SSH_CMD="ssh -i ~/.ssh/id_ed25519 root@67.211.212.18"
  PM2_ID="4"
  RELAY_NAME="mikrotik-relay"
fi

exec_cmd() {
  if [ -n "$SSH_CMD" ]; then
    $SSH_CMD "$1"
  else
    eval "$1"
  fi
}

# Padrão de busca
PATTERN="(\\[MIKROTIK\\]|liberarAcesso|relay|device-router|hotspot|ip-binding|paid_clients|mikrotik|modo inteligente|Executando|Comando falhou|Acesso liberado)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 LOGS DO DASHBOARD (PM2 ID $PM2_ID)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Terminal 1: Dashboard
exec_cmd "pm2 logs $PM2_ID --lines 0 --raw" | \
  grep --line-buffered -E "$PATTERN" | \
  while IFS= read -r line; do
    timestamp=$(date '+%H:%M:%S')
    echo "[$timestamp] $line"
  done &

DASHBOARD_PID=$!

# Aguardar um pouco antes de mostrar relay
sleep 2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔌 LOGS DO RELAY ($RELAY_NAME)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Terminal 2: Relay
exec_cmd "pm2 logs $RELAY_NAME --lines 0 --raw" | \
  while IFS= read -r line; do
    timestamp=$(date '+%H:%M:%S')
    echo "[$timestamp] $line"
  done &

RELAY_PID=$!

# Aguardar processos
wait $DASHBOARD_PID $RELAY_PID

