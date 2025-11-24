#!/bin/bash
# Script para testar se a API de checkout está funcionando

VPS_HOST="67.211.212.18"
VPS_USER="root"
DOMAIN="cativo.lopesuldashboardwifi.com"

echo "🧪 Testando API de Checkout"
echo "=========================="
echo ""

echo "1️⃣  Testando endpoint /api/pagamentos/checkout..."
echo "   Fazendo requisição POST..."

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "https://$DOMAIN/api/pagamentos/checkout" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)" \
  -d '{
    "valor": 5.00,
    "descricao": "Teste de API",
    "clienteIp": "192.168.88.100",
    "clienteMac": "AA:BB:CC:DD:EE:FF",
    "deviceId": null,
    "mikId": null,
    "customer": {
      "name": "Teste",
      "document": "12345678900"
    }
  }' 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE")

echo "   Status HTTP: $HTTP_CODE"
echo ""
echo "   Resposta:"
echo "$BODY" | head -20

if [ "$HTTP_CODE" = "200" ]; then
    echo ""
    echo "   ✅ API está respondendo!"
    
    # Verificar se tem copiaECola ou externalId
    if echo "$BODY" | grep -q "copiaECola\|externalId"; then
        echo "   ✅ Resposta contém dados do Pix!"
    else
        echo "   ⚠️  Resposta não contém copiaECola ou externalId"
    fi
else
    echo ""
    echo "   ❌ API retornou erro!"
fi

echo ""
echo "2️⃣  Verificando logs do servidor..."
ssh -i ~/.ssh/id_ed25519 "$VPS_USER@$VPS_HOST" << 'EOF'
    echo "   📋 Últimas 10 linhas de erro:"
    pm2 logs lopesul-dashboard --err --lines 10 --nostream | tail -10 | grep -E "(error|Error|ERROR|checkout|pagamentos)" || echo "   (sem erros recentes)"
    
    echo ""
    echo "   📋 Últimas 5 requisições de checkout:"
    pm2 logs lopesul-dashboard --lines 50 --nostream | grep -E "\[CHECKOUT\]|\[pagamentos/checkout\]" | tail -5 || echo "   (sem logs de checkout)"
EOF

echo ""
echo "3️⃣  Verificando se o endpoint está acessível publicamente..."
PUBLIC_TEST=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  "https://$DOMAIN/api/pagamentos/checkout" \
  -X OPTIONS \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" 2>&1)

if [ "$PUBLIC_TEST" = "200" ] || [ "$PUBLIC_TEST" = "204" ] || [ "$PUBLIC_TEST" = "405" ]; then
    echo "   ✅ Endpoint está acessível (HTTP $PUBLIC_TEST)"
else
    echo "   ⚠️  Endpoint pode não estar acessível (HTTP $PUBLIC_TEST)"
fi

echo ""
echo "4️⃣  Verificando middleware (se bloqueia /api/pagamentos)..."
ssh -i ~/.ssh/id_ed25519 "$VPS_USER@$VPS_HOST" << 'EOF'
    if [ -f "/opt/lopesul-dashboard/middleware.js" ]; then
        echo "   📋 Verificando se /api/pagamentos está na lista pública:"
        grep -E "PUBLIC_APIS|pagamentos" /opt/lopesul-dashboard/middleware.js | head -5 || echo "   (não encontrado)"
    else
        echo "   ⚠️  middleware.js não encontrado"
    fi
EOF

echo ""
echo "=========================="
echo "✅ Teste concluído!"
echo ""
echo "💡 Se a API retornou erro, verifique:"
echo "   1. Logs do servidor: pm2 logs lopesul-dashboard"
echo "   2. Se PAGARME_SECRET_KEY está configurada"
echo "   3. Se o middleware está bloqueando a requisição"

