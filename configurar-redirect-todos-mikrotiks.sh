#!/bin/bash
# Script para configurar o redirect.html em todos os Mikrotiks
# Garante que cada Mikrotik passe o mikId correto para o portal de pagamento

echo "🔧 Configurando redirect.html em todos os Mikrotiks..."
echo ""

# Mapeamento: IP -> mikId esperado
declare -A MIKROTIKS=(
  ["10.200.200.2"]="LOPESUL-HOTSPOT-01"
  ["10.200.200.3"]="LOPESUL-HOTSPOT-02"
  ["10.200.200.4"]="LOPESUL-HOTSPOT-03"
  ["10.200.200.5"]="LOPESUL-HOTSPOT-04"
  ["10.200.200.6"]="LOPESUL-HOTSPOT-05"
  ["10.200.200.7"]="LOPESUL-HOTSPOT-06"
)

# URL do portal de pagamento
PORTAL_URL="https://cativo.lopesuldashboardwifi.com/pagamento.html"

for IP in "${!MIKROTIKS[@]}"; do
  MIKID="${MIKROTIKS[$IP]}"
  echo "📡 Configurando $IP (mikId: $MIKID)..."

  # Criar o redirect.html
  REDIRECT_HTML="<meta http-equiv=\"refresh\" content=\"0; url=${PORTAL_URL}?mac=\$(mac)&ip=\$(ip)&mikId=${MIKID}&deviceId=${MIKID}\$(if link-orig)&link-orig=\$(link-orig)\$(endif)\">"

  # Upload via SSH (assumindo que tem acesso via relay)
  echo "$REDIRECT_HTML" | sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no relay@$IP \
    '/file put file-name="redirect.html" contents=' 2>/dev/null

  if [ $? -eq 0 ]; then
    echo "   ✅ redirect.html configurado"
  else
    echo "   ⚠️  Erro ao configurar (pode precisar de acesso SSH direto)"
    echo "   💡 Configure manualmente no Mikrotik:"
    echo "      /file print"
    echo "      /file set redirect.html contents=\"$REDIRECT_HTML\""
  fi

  # Configurar o hotspot profile para usar o redirect.html
  sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no relay@$IP \
    '/ip hotspot profile set [find name="default"] html-directory="/redirect.html"' 2>/dev/null

  if [ $? -eq 0 ]; then
    echo "   ✅ Hotspot profile configurado"
  else
    echo "   ⚠️  Erro ao configurar hotspot profile"
  fi

  echo ""
done

echo "✅ Configuração concluída!"
echo ""
echo "💡 IMPORTANTE: Verifique se o identity de cada Mikrotik corresponde ao mikId configurado"
echo "   Execute: /system identity print em cada Mikrotik"

