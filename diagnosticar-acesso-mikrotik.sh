#!/bin/bash
# Script para diagnosticar por que cliente não consegue acessar mesmo estando liberado
# Uso: ./diagnosticar-acesso-mikrotik.sh <IP>

IP=${1:-"192.168.88.67"}
MIKROTIK="10.200.200.7"

echo "🔍 Diagnosticando acesso para IP: $IP"
echo "📡 Mikrotik: $MIKROTIK"
echo ""

# 1. Verificar se IP está na lista paid_clients
echo "1️⃣ Verificando lista 'paid_clients':"
PAID=$(sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no relay@$MIKROTIK \
  "/ip/firewall/address-list/print where address=$IP and list=paid_clients" 2>/dev/null)

if [ -n "$PAID" ] && [ "$PAID" != "" ]; then
  echo "   ✅ IP está na lista paid_clients:"
  echo "$PAID" | sed 's/^/      /'
else
  echo "   ❌ IP NÃO está na lista paid_clients"
fi

echo ""

# 2. Verificar regras de firewall
echo "2️⃣ Verificando regras de firewall (forward chain):"
sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no relay@$MIKROTIK \
  "/ip/firewall/filter/print where chain=forward" 2>/dev/null | grep -E "paid_clients|action=accept" | head -10 | sed 's/^/      /'

echo ""

# 3. Verificar IP binding
echo "3️⃣ Verificando IP binding no hotspot:"
BINDING=$(sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no relay@$MIKROTIK \
  "/ip/hotspot/ip-binding/print where address=$IP" 2>/dev/null)

if [ -n "$BINDING" ] && [ "$BINDING" != "" ]; then
  echo "   ✅ IP binding encontrado:"
  echo "$BINDING" | sed 's/^/      /'
else
  echo "   ❌ IP binding NÃO encontrado"
fi

echo ""

# 4. Verificar sessões ativas no hotspot
echo "4️⃣ Verificando sessões ativas no hotspot:"
ATIVAS=$(sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no relay@$MIKROTIK \
  "/ip/hotspot/active/print where address=$IP" 2>/dev/null)

if [ -n "$ATIVAS" ] && [ "$ATIVAS" != "" ]; then
  echo "   ✅ Sessão ativa encontrada:"
  echo "$ATIVAS" | sed 's/^/      /'
else
  echo "   ⚠️  Nenhuma sessão ativa (pode ser normal se cliente não está conectado)"
fi

echo ""

# 5. Verificar se há bloqueios
echo "5️⃣ Verificando se há bloqueios ou conexões pendentes:"
CONEXOES=$(sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no relay@$MIKROTIK \
  "/ip/firewall/connection/print where src-address=$IP or dst-address=$IP" 2>/dev/null | head -5)

if [ -n "$CONEXOES" ] && [ "$CONEXOES" != "" ]; then
  echo "   📊 Conexões encontradas:"
  echo "$CONEXOES" | sed 's/^/      /'
else
  echo "   ℹ️  Nenhuma conexão ativa (cliente pode não estar conectado)"
fi

echo ""

# 6. Verificar configuração do hotspot profile
echo "6️⃣ Verificando perfil do hotspot:"
PROFILE=$(sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no relay@$MIKROTIK \
  "/ip/hotspot/profile/print" 2>/dev/null | head -10)

if [ -n "$PROFILE" ]; then
  echo "   📋 Perfis configurados:"
  echo "$PROFILE" | sed 's/^/      /'
fi

echo ""
echo "💡 DIAGNÓSTICO:"
echo "   Se o IP está na lista paid_clients mas cliente não acessa, pode ser:"
echo "   1. Cliente precisa autenticar no hotspot (criar sessão ativa)"
echo "   2. Regras de firewall não estão permitindo tráfego"
echo "   3. Cliente não está conectado ao Wi-Fi"
echo "   4. IP mudou novamente"

