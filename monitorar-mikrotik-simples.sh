#!/bin/bash
# Script SIMPLES para monitorar Mikrotik em tempo real
# Uso: ./monitorar-mikrotik-simples.sh

# Verificar se está no servidor
if [ -f "/opt/lopesul-dashboard/package.json" ]; then
  # No servidor
  pm2 logs 4 --lines 0 --raw | grep --line-buffered -E "(\[MIKROTIK\]|liberarAcesso|relay|device-router|hotspot|ip-binding|paid_clients|mikrotik|modo inteligente|Executando|Comando falhou|Acesso liberado)"
else
  # Local, usar SSH
  ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs 4 --lines 0 --raw' | grep --line-buffered -E "(\[MIKROTIK\]|liberarAcesso|relay|device-router|hotspot|ip-binding|paid_clients|mikrotik|modo inteligente|Executando|Comando falhou|Acesso liberado)"
fi

