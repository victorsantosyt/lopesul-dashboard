#!/bin/bash
# Script para corrigir completamente o hotspot do Mikrotik
# Resolve o problema "página da web não disponível"

RELAY_USER="relay"
RELAY_PASS="api2025"
VPS_HOST="67.211.212.18"
VPS_USER="root"
MIKROTIK_IP="${1:-10.200.200.7}"

echo "🔧 Corrigindo Hotspot Mikrotik - Solução Completa"
echo "=================================================="
echo ""

# Criar o redirect.html correto
REDIRECT_HTML='<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=$(mac)&ip=$(ip)&mikId=$(identity)&deviceId=$(identity)">
<title>Redirecionando...</title>
</head>
<body>
<h2>Aguarde, redirecionando para o portal de pagamento...</h2>
<script>
setTimeout(function() {
  var mac = "$(mac)";
  var ip = "$(ip)";
  var mikId = "$(identity)";
  var url = "https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=" + encodeURIComponent(mac) + "&ip=" + encodeURIComponent(ip);
  if (mikId) {
    url += "&mikId=" + encodeURIComponent(mikId);
  }
  window.location.href = url;
}, 100);
</script>
</body>
</html>'

echo "1️⃣  Criando redirect.html no servidor..."
ssh -i ~/.ssh/id_ed25519 "$VPS_USER@$VPS_HOST" << EOF
cat > /tmp/redirect.html << 'REDIRECT_EOF'
$REDIRECT_HTML
REDIRECT_EOF

echo "   ✅ Arquivo criado em /tmp/redirect.html"
EOF

echo ""
echo "2️⃣  Fazendo upload do redirect.html para o Mikrotik..."
ssh -i ~/.ssh/id_ed25519 "$VPS_USER@$VPS_HOST" << EOF
# Upload via FTP
cat > /tmp/upload-redirect.sh << 'FTP_EOF'
#!/bin/bash
ftp -n $MIKROTIK_IP << FTP_INNER
user $RELAY_USER $RELAY_PASS
binary
cd hotspot
put /tmp/redirect.html redirect.html
quit
FTP_INNER
FTP_EOF

chmod +x /tmp/upload-redirect.sh
/tmp/upload-redirect.sh

# Verificar se foi criado
sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no $RELAY_USER@$MIKROTIK_IP "/file print where name~redirect" | head -3
EOF

echo ""
echo "3️⃣  Configurando Walled Garden (domínios permitidos)..."
ssh -i ~/.ssh/id_ed25519 "$VPS_USER@$VPS_HOST" << EOF
sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no $RELAY_USER@$MIKROTIK_IP << 'MIKROTIK_CMDS'
# Remover entradas antigas (se existirem)
/ip hotspot/walled-garden/remove [find dst-host~"lopesuldashboardwifi.com"]
/ip hotspot/walled-garden/remove [find dst-host~"pagar.me"]

# Adicionar domínios necessários
/ip hotspot/walled-garden/add dst-host=cativo.lopesuldashboardwifi.com comment="Portal de pagamento"
/ip hotspot/walled-garden/add dst-host=painel.lopesuldashboardwifi.com comment="API backend"
/ip hotspot/walled-garden/add dst-host=*.pagar.me comment="Gateway de pagamento"
/ip hotspot/walled-garden/add dst-host=api.pagar.me comment="API Pagar.me"
/ip hotspot/walled-garden/add dst-host=*.stripe.com comment="Stripe (se usar)"
/ip hotspot/walled-garden/add dst-host=cdnjs.cloudflare.com comment="CDN JS"
/ip hotspot/walled-garden/add dst-host=fonts.googleapis.com comment="Google Fonts"

echo "✅ Walled Garden configurado"
MIKROTIK_CMDS
EOF

echo ""
echo "4️⃣  Configurando perfil do hotspot..."
ssh -i ~/.ssh/id_ed25519 "$VPS_USER@$VPS_HOST" << EOF
sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no $RELAY_USER@$MIKROTIK_IP << 'MIKROTIK_CMDS'
# Verificar se o perfil existe
/ip hotspot/profile/print where name=default

# Configurar html-directory
/ip hotspot/profile/set [find name=default] html-directory=hotspot

echo "✅ Perfil configurado"
MIKROTIK_CMDS
EOF

echo ""
echo "5️⃣  Verificando configuração final..."
ssh -i ~/.ssh/id_ed25519 "$VPS_USER@$VPS_HOST" << EOF
echo "   📋 Arquivo redirect.html:"
sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no $RELAY_USER@$MIKROTIK_IP "/file print where name~redirect" | head -3

echo ""
echo "   📋 Walled Garden:"
sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no $RELAY_USER@$MIKROTIK_IP "/ip hotspot/walled-garden/print" | grep -E "dst-host|comment" | head -8

echo ""
echo "   📋 Perfil hotspot:"
sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no $RELAY_USER@$MIKROTIK_IP "/ip hotspot/profile/print" | grep -E "name|html-directory"
EOF

echo ""
echo "=================================================="
echo "✅ Configuração concluída!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Conecte um celular no WiFi do ônibus"
echo "   2. Tente acessar qualquer site (ex: http://google.com)"
echo "   3. Deve redirecionar automaticamente para o portal"
echo "   4. A URL deve ter: ?mac=XX:XX:XX:XX:XX:XX&ip=192.168.88.X"
echo ""
echo "💡 Se ainda não funcionar, verifique:"
echo "   - Se o hotspot está ativo: /ip hotspot/print"
echo "   - Se há clientes conectados: /ip hotspot/active/print"

