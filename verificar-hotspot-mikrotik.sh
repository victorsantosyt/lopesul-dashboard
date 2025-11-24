#!/bin/bash
# Script para verificar configuração completa do hotspot no Mikrotik

RELAY_USER="relay"
RELAY_PASS="api2025"
VPS_HOST="67.211.212.18"
VPS_USER="root"
MIKROTIK_IP="${1:-10.200.200.7}"

echo "🔍 Verificando Configuração do Hotspot no Mikrotik"
echo "=================================================="
echo ""

# Função para executar comando no Mikrotik via VPS
exec_mikrotik() {
    local cmd="$1"
    SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
    
    if [ -f "$SSH_KEY" ]; then
        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
            "$VPS_USER@$VPS_HOST" \
            "sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
            '$RELAY_USER@$MIKROTIK_IP' '$cmd'"
    else
        ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
            "$VPS_USER@$VPS_HOST" \
            "sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
            '$RELAY_USER@$MIKROTIK_IP' '$cmd'"
    fi
}

echo "1️⃣  Verificando arquivo redirect.html..."
REDIRECT=$(exec_mikrotik "/file print where name~redirect" 2>&1)
if echo "$REDIRECT" | grep -q "redirect.html"; then
    echo "   ✅ Arquivo redirect.html encontrado"
    echo "$REDIRECT" | head -5
else
    echo "   ❌ Arquivo redirect.html NÃO encontrado!"
fi

echo ""
echo "2️⃣  Verificando perfil do hotspot..."
PROFILE=$(exec_mikrotik "/ip hotspot profile print" 2>&1)
if echo "$PROFILE" | grep -q "html-directory"; then
    echo "   ✅ Perfil configurado"
    echo "$PROFILE" | grep -E "name|html-directory|login-by|http-cookie-lifetime"
else
    echo "   ⚠️  Perfil pode não estar configurado corretamente"
    echo "$PROFILE"
fi

echo ""
echo "3️⃣  Verificando Walled Garden (domínios permitidos)..."
WG=$(exec_mikrotik "/ip hotspot/walled-garden/print" 2>&1)
REQUIRED_DOMAINS=("cativo.lopesuldashboardwifi.com" "painel.lopesuldashboardwifi.com" "*.pagar.me" "api.pagar.me")

echo "   Domínios configurados:"
echo "$WG" | grep -E "dst-host|dst-address" | head -10

echo ""
echo "   Verificando domínios necessários:"
for domain in "${REQUIRED_DOMAINS[@]}"; do
    if echo "$WG" | grep -q "$domain"; then
        echo "   ✅ $domain"
    else
        echo "   ❌ $domain (FALTANDO!)"
    fi
done

echo ""
echo "4️⃣  Verificando servidor hotspot..."
SERVER=$(exec_mikrotik "/ip hotspot print" 2>&1)
if echo "$SERVER" | grep -q "interface"; then
    echo "   ✅ Servidor hotspot ativo"
    echo "$SERVER" | grep -E "interface|address-pool|profile"
else
    echo "   ❌ Servidor hotspot não encontrado"
fi

echo ""
echo "5️⃣  Verificando DNS do Mikrotik..."
DNS=$(exec_mikrotik "/ip dns print" 2>&1)
if echo "$DNS" | grep -q "servers"; then
    echo "   ✅ DNS configurado"
    echo "$DNS" | grep -E "servers|allow-remote-requests"
else
    echo "   ⚠️  DNS pode não estar configurado"
fi

echo ""
echo "6️⃣  Verificando clientes ativos..."
ACTIVE=$(exec_mikrotik "/ip hotspot active print" 2>&1)
if echo "$ACTIVE" | grep -q "address"; then
    echo "   ✅ Clientes conectados:"
    echo "$ACTIVE" | grep -E "address|mac-address|user" | head -5
else
    echo "   ℹ️  Nenhum cliente conectado no momento"
fi

echo ""
echo "=================================================="
echo "✅ Verificação concluída!"
echo ""
echo "💡 Se algum domínio estiver faltando no Walled Garden,"
echo "   execute o script de configuração: setup-mikrotik-hotspot.sh"

