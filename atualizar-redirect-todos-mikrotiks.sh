#!/bin/bash
# Script para atualizar o redirect.html em todos os Mikrotiks
# Após renomear os dispositivos no banco, execute este script para atualizar os redirects

echo "🔧 Atualizando redirect.html em todos os Mikrotiks..."
echo ""

# Mapeamento: IP -> mikId (deve corresponder ao que foi configurado no banco)
declare -A MIKROTIKS=(
  ["10.200.200.2"]="LOPESUL-HOTSPOT-01"
  ["10.200.200.3"]="LOPESUL-HOTSPOT-02"
  ["10.200.200.4"]="LOPESUL-HOTSPOT-03"
  ["10.200.200.5"]="LOPESUL-HOTSPOT-04"
  ["10.200.200.6"]="LOPESUL-HOTSPOT-05"
  ["10.200.200.7"]="LOPESUL-HOTSPOT-06"
)

PORTAL_URL="https://cativo.lopesuldashboardwifi.com/pagamento.html"

for IP in "${!MIKROTIKS[@]}"; do
  MIKID="${MIKROTIKS[$IP]}"
  echo "📡 Configurando $IP (mikId: $MIKID)..."

  # Criar o conteúdo do redirect.html
  REDIRECT_CONTENT="<meta http-equiv=\"refresh\" content=\"0; url=${PORTAL_URL}?mac=\$(mac)&ip=\$(ip)&mikId=${MIKID}&deviceId=${MIKID}\$(if link-orig)&link-orig=\$(link-orig)\$(endif)\">"

  # Tentar via SSH
  echo "$REDIRECT_CONTENT" | sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 relay@$IP \
    '/file set redirect.html contents=' 2>/dev/null

  if [ $? -eq 0 ]; then
    echo "   ✅ redirect.html atualizado via SSH"
  else
    echo "   ⚠️  Não foi possível atualizar via SSH"
    echo "   💡 Execute manualmente no Mikrotik:"
    echo "      ssh relay@$IP"
    echo "      /file set redirect.html contents=\"$REDIRECT_CONTENT\""
  fi

  # Verificar se o hotspot profile está usando redirect.html
  sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 relay@$IP \
    '/ip hotspot profile set [find name="default"] html-directory="/redirect.html"' 2>/dev/null

  if [ $? -eq 0 ]; then
    echo "   ✅ Hotspot profile configurado"
  else
    echo "   ⚠️  Não foi possível configurar hotspot profile via SSH"
    echo "   💡 Execute manualmente: /ip hotspot profile set [find name=\"default\"] html-directory=\"/redirect.html\""
  fi

  echo ""
done

echo "✅ Processo concluído!"
echo ""
echo "💡 IMPORTANTE: Verifique se o identity de cada Mikrotik corresponde ao mikId configurado"
echo "   Execute em cada Mikrotik: /system identity print"

