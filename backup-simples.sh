#!/bin/bash
# Script simples para fazer backup do banco
cd /opt/lopesul-dashboard

# Carregar DATABASE_URL do .env de forma segura
DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Erro: DATABASE_URL não encontrada no .env"
  exit 1
fi

# Remover parâmetros de query que pg_dump não aceita (como ?schema=public)
DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/?.*$//')

# Criar diretório de backup
mkdir -p /backup

# Nome do arquivo
BACKUP_FILE="/backup/backup-$(date +%Y%m%d-%H%M%S).sql"

echo "💾 Fazendo backup do banco de dados..."
echo "📦 Arquivo: $BACKUP_FILE"
echo ""

# Fazer backup
pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>&1

# Verificar se funcionou
if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Backup criado com sucesso!"
  echo "📊 Tamanho: $SIZE"
  echo "📁 Arquivo: $BACKUP_FILE"
else
  echo "❌ Erro ao criar backup!"
  echo "💡 Verifique se DATABASE_URL está correta"
  exit 1
fi

