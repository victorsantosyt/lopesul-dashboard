#!/bin/bash

# Script para monitorar o teste real do portal de pagamento
# Uso: ./monitorar-teste-real.sh

echo "🔍 Monitorando teste real do portal de pagamento..."
echo "Pressione Ctrl+C para parar"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Terminal 1: Logs gerais do dashboard
echo -e "${BLUE}=== LOGS DO DASHBOARD (pm2 logs 4) ===${NC}"
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs 4 --lines 0 --raw' | grep -E "(Portal|detect-client|checkout|webhook|MIKROTIK|deviceIdentifier|deviceId|mikId|QR|Erro|ERROR)" --color=always

