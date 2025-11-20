#!/bin/bash
# Script para fazer backup do banco de dados (Railway/remoto)
# Uso: ./fazer-backup-banco.sh

echo "💾 Fazendo backup do banco de dados..."

# Carregar variáveis de ambiente
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Verificar se DATABASE_URL existe
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Erro: DATABASE_URL não encontrada!"
  echo "💡 Verifique se o arquivo .env existe e tem DATABASE_URL configurada"
  exit 1
fi

# Criar diretório de backup se não existir
mkdir -p /backup

# Nome do arquivo de backup
BACKUP_FILE="/backup/backup-$(date +%Y%m%d-%H%M%S).sql"

echo "📦 Fazendo backup para: $BACKUP_FILE"
echo "🔗 Conectando ao banco remoto..."

# Fazer backup usando DATABASE_URL completa
# pg_dump aceita URL diretamente se usar o formato correto
pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>&1

# Verificar se backup foi bem-sucedido
if [ $? -eq 0 ]; then
  # Verificar se arquivo foi criado e tem conteúdo
  if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup criado com sucesso!"
    echo "📊 Tamanho: $SIZE"
    echo "📁 Arquivo: $BACKUP_FILE"
    
    # Listar últimos 5 backups
    echo ""
    echo "📋 Últimos 5 backups:"
    ls -lh /backup/*.sql 2>/dev/null | tail -5 | awk '{print $9, "(" $5 ")"}'
  else
    echo "❌ Erro: Arquivo de backup vazio ou não criado!"
    exit 1
  fi
else
  echo "❌ Erro ao fazer backup!"
  echo "💡 Verifique se DATABASE_URL está correta e se tem acesso ao banco"
  exit 1
fi

