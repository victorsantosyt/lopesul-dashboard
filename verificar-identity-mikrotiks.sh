#!/bin/bash
# Script para verificar o identity de cada Mikrotik
# Isso ajuda a mapear qual mikId cada Mikrotik está enviando

echo "🔍 Verificando identity de cada Mikrotik..."
echo ""

IPS=("10.200.200.2" "10.200.200.3" "10.200.200.4" "10.200.200.5" "10.200.200.6" "10.200.200.7")

for IP in "${IPS[@]}"; do
  echo "📡 Verificando $IP..."
  
  # Tentar obter o identity via SSH (se tiver acesso)
  IDENTITY=$(sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no relay@$IP '/system identity print' 2>/dev/null | grep 'name:' | awk '{print $2}' || echo "não acessível")
  
  if [ "$IDENTITY" != "não acessível" ]; then
    echo "   ✅ Identity: $IDENTITY"
  else
    echo "   ⚠️  Não foi possível acessar (pode precisar de configuração SSH)"
    echo "   💡 Verifique manualmente no Mikrotik: /system identity print"
  fi
  echo ""
done

echo "💡 Use esses valores para atualizar o MAPEAMENTO_MIKROTIKS no script configurar-todos-dispositivos.js"

