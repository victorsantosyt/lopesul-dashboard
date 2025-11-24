#!/bin/bash
# Script completo de diagnóstico do sistema
# Execute no servidor: bash diagnostico-completo.sh

echo "═══════════════════════════════════════════════════════════════"
echo "🔍 DIAGNÓSTICO COMPLETO - LOPESUL DASHBOARD"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. Verificar pedidos recentes
echo "📦 1. PEDIDOS RECENTES (última hora)"
echo "───────────────────────────────────────────────────────────────"
cd /opt/lopesul-dashboard
export DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -c "SELECT code, id, status, \"deviceId\", ip, mac, \"createdAt\" FROM \"Pedido\" WHERE \"createdAt\" > NOW() - INTERVAL '1 hour' ORDER BY \"createdAt\" DESC LIMIT 5;" 2>/dev/null || echo "  ❌ Erro ao consultar pedidos"
else
    echo "  ❌ DATABASE_URL não encontrado"
fi
echo ""

# 2. Verificar pedidos PAID/PENDING
echo "💰 2. PEDIDOS PAID/PENDING"
echo "───────────────────────────────────────────────────────────────"
if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -c "SELECT code, id, status, \"deviceId\", ip, mac, \"createdAt\" FROM \"Pedido\" WHERE status IN ('PAID', 'PENDING') ORDER BY \"createdAt\" DESC LIMIT 5;" 2>/dev/null || echo "  ❌ Erro ao consultar pedidos"
else
    echo "  ❌ DATABASE_URL não encontrado"
fi
echo ""

# 3. Verificar status do relay
echo "🔌 3. STATUS DO RELAY INTELIGENTE"
echo "───────────────────────────────────────────────────────────────"
pm2 logs mikrotik-relay --lines 5 --nostream | grep -E "(Prisma|Modo inteligente|relay.*http)" | tail -5 || echo "  ⚠️  Nenhum log relevante encontrado"
echo ""

# 4. Verificar se relay tem DATABASE_URL
echo "🔑 4. CONFIGURAÇÃO DO RELAY"
echo "───────────────────────────────────────────────────────────────"
cd /opt/lopesul-infra/relay
if [ -f .env ]; then
    if grep -q "^DATABASE_URL" .env; then
        echo "  ✅ DATABASE_URL configurado"
        grep "^DATABASE_URL" .env | sed 's/\(.*:\)[^:]*\(@.*\)/\1****\2/' # Mascarar senha
    else
        echo "  ❌ DATABASE_URL não encontrado no .env"
    fi
else
    echo "  ❌ Arquivo .env não encontrado"
fi
echo ""

# 5. Verificar Prisma Client no relay
echo "📦 5. PRISMA CLIENT NO RELAY"
echo "───────────────────────────────────────────────────────────────"
if [ -f /opt/lopesul-infra/relay/node_modules/@prisma/client/package.json ]; then
    echo "  ✅ @prisma/client encontrado"
    cat /opt/lopesul-infra/relay/node_modules/@prisma/client/package.json | grep '"version"' | head -1
else
    echo "  ❌ @prisma/client não encontrado"
fi
if [ -f /opt/lopesul-infra/relay/node_modules/.prisma/client/index.js ]; then
    echo "  ✅ .prisma/client encontrado"
else
    echo "  ❌ .prisma/client não encontrado"
fi
echo ""

# 6. Verificar logs do webhook recentes
echo "📨 6. LOGS DO WEBHOOK (últimas 10 linhas relevantes)"
echo "───────────────────────────────────────────────────────────────"
pm2 logs 4 --lines 50 --nostream | grep -E "(webhook|markPaidAndRelease|liberarAcesso|MIKROTIK.*modo|Tentando modo)" | tail -10 || echo "  ⚠️  Nenhum log relevante encontrado"
echo ""

# 7. Verificar última sessão ativa
echo "📋 7. ÚLTIMA SESSÃO ATIVA CRIADA"
echo "───────────────────────────────────────────────────────────────"
cd /opt/lopesul-dashboard
if [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -c "SELECT id, \"ipCliente\", \"macCliente\", plano, \"pedidoId\", \"roteadorId\", \"inicioEm\" FROM \"SessaoAtiva\" ORDER BY \"inicioEm\" DESC LIMIT 1;" 2>/dev/null || echo "  ❌ Erro ao consultar sessões"
else
    echo "  ❌ DATABASE_URL não encontrado"
fi
echo ""

# 8. Status PM2
echo "⚙️  8. STATUS DOS PROCESSOS PM2"
echo "───────────────────────────────────────────────────────────────"
pm2 list
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "✅ DIAGNÓSTICO CONCLUÍDO"
echo "═══════════════════════════════════════════════════════════════"

