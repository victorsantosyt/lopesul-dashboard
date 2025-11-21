#!/bin/bash
# Script para ver logs relacionados ao Mikrotik

echo "📋 Logs do Mikrotik (últimas 100 linhas):"
echo ""
pm2 logs 4 --lines 100 --nostream | grep -E "(MIKROTIK|liberarAcesso|relay|mikrotik|hotspot|ip-binding|paid_clients)" | tail -50

echo ""
echo "📋 Todos os logs de liberação:"
echo ""
pm2 logs 4 --lines 200 --nostream | grep -E "(liberar-acesso|liberarAcesso|MIKROTIK)" | tail -100

echo ""
echo "📋 Logs de erro relacionados ao Mikrotik:"
echo ""
pm2 logs 4 --err --lines 200 --nostream | grep -E "(MIKROTIK|mikrotik|relay|liberar)" | tail -50

