#!/bin/bash
# Script de diagnóstico para o problema "página da web não disponível"

VPS_HOST="67.211.212.18"
VPS_USER="root"
DOMAIN="cativo.lopesuldashboardwifi.com"

echo "🔍 Diagnóstico do Portal de Pagamento"
echo "======================================"
echo ""

echo "1️⃣  Verificando se o servidor está respondendo..."
echo "   Testando: https://$DOMAIN/pagamento.html"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$DOMAIN/pagamento.html" 2>&1)
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Servidor respondendo (HTTP $HTTP_CODE)"
else
    echo "   ❌ Servidor não respondeu corretamente (HTTP $HTTP_CODE)"
    echo "   Tentando HTTP (sem SSL)..."
    HTTP_CODE_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://$DOMAIN/pagamento.html" 2>&1)
    if [ "$HTTP_CODE_HTTP" = "200" ]; then
        echo "   ⚠️  HTTP funciona, mas HTTPS não!"
    else
        echo "   ❌ Nem HTTP nem HTTPS funcionam"
    fi
fi

echo ""
echo "2️⃣  Verificando DNS..."
DNS_IP=$(dig +short $DOMAIN 2>/dev/null | head -1)
if [ -n "$DNS_IP" ]; then
    echo "   ✅ DNS resolvido: $DOMAIN -> $DNS_IP"
else
    echo "   ❌ DNS não resolveu"
fi

echo ""
echo "3️⃣  Verificando conectividade do servidor..."
if ping -c 1 -W 2 "$VPS_HOST" &>/dev/null; then
    echo "   ✅ Servidor VPS acessível ($VPS_HOST)"
else
    echo "   ❌ Servidor VPS não acessível"
fi

echo ""
echo "4️⃣  Verificando logs do servidor (últimas 20 linhas)..."
echo "   Executando no servidor..."
ssh -i ~/.ssh/id_ed25519 "$VPS_USER@$VPS_HOST" << 'EOF'
    echo "   📋 Logs do PM2 (dashboard):"
    pm2 logs lopesul-dashboard --lines 20 --nostream | tail -20 | grep -E "(error|Error|ERROR|pagamento|pagamento.html)" || echo "   (sem erros recentes)"
    
    echo ""
    echo "   📋 Verificando se o Next.js está rodando:"
    if pm2 list | grep -q "lopesul-dashboard.*online"; then
        echo "   ✅ Next.js está online"
    else
        echo "   ❌ Next.js está offline!"
    fi
    
    echo ""
    echo "   📋 Testando acesso local no servidor:"
    curl -s -o /dev/null -w "   HTTP Status: %{http_code}\n" --max-time 5 "http://localhost:3000/pagamento.html" || echo "   ❌ Erro ao acessar localmente"
EOF

echo ""
echo "5️⃣  Verificando certificado SSL..."
SSL_CHECK=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
if [ -n "$SSL_CHECK" ]; then
    echo "   ✅ Certificado SSL válido"
    echo "$SSL_CHECK" | head -2
else
    echo "   ⚠️  Problema com certificado SSL ou conexão"
fi

echo ""
echo "6️⃣  Verificando arquivo pagamento.html no servidor..."
ssh -i ~/.ssh/id_ed25519 "$VPS_USER@$VPS_HOST" << 'EOF'
    if [ -f "/opt/lopesul-dashboard/public/pagamento.html" ]; then
        echo "   ✅ Arquivo existe"
        echo "   Tamanho: $(stat -f%z /opt/lopesul-dashboard/public/pagamento.html 2>/dev/null || stat -c%s /opt/lopesul-dashboard/public/pagamento.html 2>/dev/null) bytes"
    else
        echo "   ❌ Arquivo não encontrado!"
    fi
EOF

echo ""
echo "7️⃣  Testando acesso completo (simulando cliente)..."
echo "   Fazendo requisição completa..."
FULL_TEST=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" --max-time 10 \
    -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)" \
    "https://$DOMAIN/pagamento.html" 2>&1 | tail -2)

HTTP_CODE_FULL=$(echo "$FULL_TEST" | grep "HTTP_CODE" | cut -d: -f2)
TIME_FULL=$(echo "$FULL_TEST" | grep "TIME" | cut -d: -f2)

if [ "$HTTP_CODE_FULL" = "200" ]; then
    echo "   ✅ Portal acessível (HTTP $HTTP_CODE_FULL, tempo: ${TIME_FULL}s)"
else
    echo "   ❌ Portal inacessível (HTTP $HTTP_CODE_FULL)"
fi

echo ""
echo "======================================"
echo "✅ Diagnóstico concluído!"
echo ""
echo "💡 Próximos passos se o problema persistir:"
echo "   1. Verifique se o domínio está apontando para o IP correto"
echo "   2. Verifique se o firewall está bloqueando a porta 443"
echo "   3. Verifique os logs do servidor: pm2 logs lopesul-dashboard"
echo "   4. Teste acessar diretamente: https://$DOMAIN/pagamento.html?ip=192.168.88.100&mac=AA:BB:CC:DD:EE:FF"

