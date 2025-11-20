#!/bin/bash
# Script para copiar os scripts de backup e deploy para o servidor
# Uso: ./copiar-scripts-servidor.sh

SERVER="root@67.211.212.18"
SERVER_PATH="/opt/lopesul-dashboard"

echo "📤 Copiando scripts para o servidor..."

# Copiar scripts
scp -i ~/.ssh/id_ed25519 fazer-backup-banco.sh deploy-seguro-com-backup.sh $SERVER:$SERVER_PATH/

# Dar permissão de execução
ssh -i ~/.ssh/id_ed25519 $SERVER "chmod +x $SERVER_PATH/fazer-backup-banco.sh $SERVER_PATH/deploy-seguro-com-backup.sh"

echo "✅ Scripts copiados e com permissão de execução!"
echo ""
echo "💡 No servidor, execute:"
echo "   cd /opt/lopesul-dashboard"
echo "   ./deploy-seguro-com-backup.sh"

