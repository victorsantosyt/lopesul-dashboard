#!/bin/bash
# Script para deploy seguro com backup automático
# Uso: ./deploy-seguro-com-backup.sh

set -e  # Parar se houver erro

echo "🚀 Deploy Seguro com Backup"
echo "============================"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Diretório do projeto
PROJECT_DIR="/opt/lopesul-dashboard"
BACKUP_DIR="/backup"

# 1. Fazer backup do banco
echo -e "${YELLOW}📦 Passo 1: Fazendo backup do banco de dados...${NC}"
cd "$PROJECT_DIR"

# Carregar .env se existir
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ Erro: DATABASE_URL não encontrada!${NC}"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup-antes-deploy-$(date +%Y%m%d-%H%M%S).sql"

echo "💾 Backup para: $BACKUP_FILE"
pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>&1

if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo -e "${GREEN}✅ Backup criado: $SIZE${NC}"
else
  echo -e "${RED}❌ Erro ao criar backup! Abortando deploy.${NC}"
  exit 1
fi

echo ""

# 2. Fazer pull do código
echo -e "${YELLOW}📥 Passo 2: Fazendo pull do código...${NC}"
git pull

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Erro no git pull!${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Código atualizado${NC}"
echo ""

# 3. Instalar dependências (se necessário)
echo -e "${YELLOW}📦 Passo 3: Verificando dependências...${NC}"
if [ -f package.json ] && [ package.json -nt node_modules/.package-lock.json 2>/dev/null ]; then
  echo "Instalando dependências..."
  npm install
fi

echo ""

# 4. Gerar Prisma Client (se necessário)
echo -e "${YELLOW}🔧 Passo 4: Verificando Prisma Client...${NC}"
if [ -f prisma/schema.prisma ]; then
  npx prisma generate
fi

echo ""

# 5. Build
echo -e "${YELLOW}🔨 Passo 5: Fazendo build...${NC}"
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Erro no build! NÃO reiniciando serviços.${NC}"
  echo -e "${YELLOW}💡 Corrija os erros antes de continuar.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Build concluído${NC}"
echo ""

# 6. Reiniciar serviços
echo -e "${YELLOW}🔄 Passo 6: Reiniciando serviços...${NC}"
pm2 restart 4

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Serviço reiniciado${NC}"
else
  echo -e "${RED}❌ Erro ao reiniciar serviço!${NC}"
  exit 1
fi

echo ""

# 7. Verificar status
echo -e "${YELLOW}📊 Passo 7: Verificando status...${NC}"
sleep 3
pm2 list

echo ""
echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo ""
echo "📋 Próximos passos:"
echo "1. Monitorar logs: pm2 logs 4 --lines 0"
echo "2. Verificar se não há erros: pm2 logs 4 --err --lines 20"
echo "3. Testar portal de pagamento manualmente"
echo ""
echo "💾 Backup salvo em: $BACKUP_FILE"

