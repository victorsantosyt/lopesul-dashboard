#!/bin/bash
# Script para monitorar em tempo real TODAS as requisições e atividades do Mikrotik
# Uso: ./monitorar-mikrotik-tempo-real.sh

echo "🔍 Monitorando Mikrotik em TEMPO REAL"
echo "📡 Todas as requisições, comandos e respostas"
echo "⏹️  Pressione Ctrl+C para parar"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cores para melhor visualização
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Função para colorir logs
colorize_log() {
  sed \
    -e "s/\[MIKROTIK\]/${GREEN}[MIKROTIK]${NC}/g" \
    -e "s/✅/${GREEN}✅${NC}/g" \
    -e "s/❌/${RED}❌${NC}/g" \
    -e "s/⚠️/${YELLOW}⚠️${NC}/g" \
    -e "s/📡/${CYAN}📡${NC}/g" \
    -e "s/🔓/${BLUE}🔓${NC}/g" \
    -e "s/Comando falhou/${RED}Comando falhou${NC}/g" \
    -e "s/Acesso liberado/${GREEN}Acesso liberado${NC}/g" \
    -e "s/relay inteligente/${MAGENTA}relay inteligente${NC}/g" \
    -e "s/relay direto/${CYAN}relay direto${NC}/g"
}

# Verificar se está no servidor ou local
if [ -f "/opt/lopesul-dashboard/package.json" ]; then
  # Está no servidor
  PM2_ID="4"
  RELAY_NAME="mikrotik-relay"
  BASE_DIR="/opt/lopesul-dashboard"
else
  # Está local, precisa SSH
  PM2_ID="4"
  RELAY_NAME="mikrotik-relay"
  SSH_CMD="ssh -i ~/.ssh/id_ed25519 root@67.211.212.18"
  BASE_DIR="/opt/lopesul-dashboard"
fi

# Função para executar comando (local ou remoto)
exec_cmd() {
  if [ -n "$SSH_CMD" ]; then
    $SSH_CMD "$1"
  else
    eval "$1"
  fi
}

echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 MONITORAMENTO COMPLETO DO MIKROTIK${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Filtros aplicados:${NC}"
echo "  • [MIKROTIK] - Todos os comandos Mikrotik"
echo "  • liberarAcesso - Liberações de acesso"
echo "  • relay - Comunicação com relay"
echo "  • device-router - Roteamento de dispositivos"
echo "  • hotspot - Configurações de hotspot"
echo "  • ip-binding - Bindings de IP"
echo "  • paid_clients - Lista de clientes pagos"
echo "  • active/remove - Remoção de sessões"
echo "  • connection/remove - Remoção de conexões"
echo "  • address-list - Lista de endereços"
echo ""

# Padrão de busca abrangente
PATTERN="(\\[MIKROTIK\\]|liberarAcesso|liberar-acesso|relay|device-router|hotspot|ip-binding|paid_clients|active/remove|connection/remove|address-list|mikrotik|Mikrotik|MIKROTIK|modo inteligente|relay inteligente|relay direto|Executando|Comando falhou|Acesso liberado|Router info|Chamando liberarAcesso)"

echo -e "${GREEN}▶ Iniciando monitoramento...${NC}"
echo ""

# Monitorar logs do dashboard (PM2 ID 4)
exec_cmd "pm2 logs $PM2_ID --lines 0 --raw" | \
  grep --line-buffered -E "$PATTERN" | \
  colorize_log | \
  while IFS= read -r line; do
    # Adicionar timestamp
    timestamp=$(date '+%H:%M:%S')
    echo -e "[$timestamp] $line"
  done

