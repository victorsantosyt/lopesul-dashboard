#!/bin/bash
# Script para resolver conflitos de git no servidor
# Uso: ./resolver-conflito-git.sh

echo "🔧 Resolvendo conflitos do git..."
echo ""

cd /opt/lopesul-dashboard || exit 1

# Verificar se há mudanças locais
if git diff --quiet package-lock.json 2>/dev/null; then
  echo "✅ Nenhuma mudança local detectada"
else
  echo "⚠️  Mudanças locais detectadas em package-lock.json"
  echo "💾 Fazendo backup..."
  cp package-lock.json package-lock.json.backup 2>/dev/null || true
  
  echo "🔄 Descartando mudanças locais..."
  git checkout -- package-lock.json
fi

echo "📥 Fazendo pull..."
git pull

if [ $? -eq 0 ]; then
  echo "✅ Git pull concluído com sucesso!"
  echo ""
  echo "📋 Scripts disponíveis:"
  ls -la monitorar-mikrotik-*.sh 2>/dev/null || echo "   (nenhum script encontrado)"
else
  echo "❌ Erro ao fazer pull"
  exit 1
fi
