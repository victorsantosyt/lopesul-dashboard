#!/bin/bash
# Script para verificar conexão com banco de dados
# Uso: ./verificar-banco.sh

cd /opt/lopesul-dashboard 2>/dev/null || cd "$(dirname "$0")" || exit 1

echo "🔍 Verificando conexão com banco de dados..."
echo ""

# Carregar DATABASE_URL do .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL não encontrada no .env"
  exit 1
fi

# Extrair host e porta da URL
HOST_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):\([0-9]*\).*/\1:\2/p')

if [ -z "$HOST_PORT" ]; then
  echo "❌ Não foi possível extrair host:porta da DATABASE_URL"
  exit 1
fi

HOST=$(echo "$HOST_PORT" | cut -d: -f1)
PORT=$(echo "$HOST_PORT" | cut -d: -f2)

echo "📡 Testando conectividade..."
echo "   Host: $HOST"
echo "   Porta: $PORT"
echo ""

# Testar conectividade TCP
if command -v nc >/dev/null 2>&1; then
  if nc -z -w 5 "$HOST" "$PORT" 2>/dev/null; then
    echo "✅ Porta $PORT está acessível em $HOST"
  else
    echo "❌ Porta $PORT NÃO está acessível em $HOST"
    echo ""
    echo "💡 Possíveis causas:"
    echo "   1. Banco de dados Railway está offline"
    echo "   2. Firewall bloqueando conexão"
    echo "   3. Problema de rede/VPN"
    exit 1
  fi
else
  echo "⚠️  'nc' (netcat) não encontrado, pulando teste de conectividade"
fi

echo ""
echo "🔍 Testando conexão via Prisma..."
node -e "
import('@prisma/client').then(async ({ PrismaClient }) => {
  const prisma = new PrismaClient();
  try {
    await prisma.\$connect();
    const count = await prisma.pedido.count();
    console.log('✅ Conexão com banco OK!');
    console.log(\`   Total de pedidos: \${count}\`);
    await prisma.\$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao conectar:', error.message);
    await prisma.\$disconnect().catch(() => {});
    process.exit(1);
  }
}).catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
"

