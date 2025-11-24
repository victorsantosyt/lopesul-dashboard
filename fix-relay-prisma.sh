#!/bin/bash
# Script para corrigir Prisma no relay

echo "🔧 Corrigindo Prisma Client no relay..."

ssh -i /Users/gleik/.ssh/id_ed25519 root@67.211.212.18 << 'EOF'
# Verificar se os arquivos existem
echo "1. Verificando Prisma Client..."
ls -la /opt/lopesul-infra/relay/node_modules/@prisma/client/package.json 2>&1 | head -3
ls -la /opt/lopesul-infra/relay/node_modules/.prisma 2>&1 | head -3

# Recopiar Prisma Client
echo ""
echo "2. Recopiando Prisma Client..."
cd /opt/lopesul-dashboard
rm -rf /opt/lopesul-infra/relay/node_modules/@prisma
rm -rf /opt/lopesul-infra/relay/node_modules/.prisma
cp -r node_modules/@prisma /opt/lopesul-infra/relay/node_modules/
cp -r node_modules/.prisma /opt/lopesul-infra/relay/node_modules/
echo "✅ Prisma Client copiado"

# Verificar DATABASE_URL
echo ""
echo "3. Verificando DATABASE_URL..."
cd /opt/lopesul-infra/relay
grep DATABASE_URL .env | head -1

# Reiniciar relay
echo ""
echo "4. Reiniciando relay..."
pm2 restart mikrotik-relay
sleep 3

# Verificar logs
echo ""
echo "5. Verificando logs do relay..."
pm2 logs mikrotik-relay --lines 10 --nostream | grep -E "(Prisma|Modo inteligente|relay.*http)" || echo "Verificando todos os logs..."
pm2 logs mikrotik-relay --lines 5 --nostream
EOF

echo ""
echo "✅ Script executado!"

