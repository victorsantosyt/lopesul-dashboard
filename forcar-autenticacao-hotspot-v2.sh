#!/bin/bash
# Script para forçar autenticação no hotspot (versão sem sshpass)
# Uso: ./forcar-autenticacao-hotspot-v2.sh <IP> <MAC>

IP=${1:-"192.168.88.67"}
MAC=${2:-"24:29:34:91:1A:18"}
MIKROTIK="10.200.200.7"

echo "🔓 Forçando autenticação no hotspot..."
echo "   IP: $IP"
echo "   MAC: $MAC"
echo "   Mikrotik: $MIKROTIK"
echo ""

# Verificar se tem acesso SSH direto ou via relay
echo "📡 Tentando conectar ao Mikrotik..."

# Criar usuário temporário se não existir
USERNAME="user_${IP//./_}"
PASSWORD="temp123"

echo "1️⃣ Criando/verificando usuário no hotspot..."

# Tentar via SSH direto (se tiver chave configurada)
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 relay@$MIKROTIK << EOF 2>/dev/null
# Criar usuário se não existir (ignora erro se já existir)
/ip/hotspot/user/add name=$USERNAME password=$PASSWORD profile=default
EOF

if [ $? -ne 0 ]; then
  echo "   ⚠️  Não foi possível conectar via SSH direto"
  echo "   💡 Tentando via API do relay..."
  
  # Tentar via API do relay
  curl -X POST http://localhost:3001/relay/exec \
    -H "Content-Type: application/json" \
    -d "{
      \"host\": \"$MIKROTIK\",
      \"user\": \"relay\",
      \"pass\": \"api2025\",
      \"command\": \"/ip/hotspot/user/add name=$USERNAME password=$PASSWORD profile=default\"
    }" 2>/dev/null
fi

echo ""

# Criar sessão ativa no hotspot
echo "2️⃣ Criando sessão ativa no hotspot..."

# Tentar via SSH direto
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 relay@$MIKROTIK << EOF 2>/dev/null
# Remover sessão antiga se existir
/ip/hotspot/active/remove [find address=$IP or mac-address=$MAC]

# Criar nova sessão ativa
/ip/hotspot/active/add server=hotspot1 user=$USERNAME address=$IP mac-address=$MAC
EOF

if [ $? -eq 0 ]; then
  echo "   ✅ Sessão ativa criada via SSH"
else
  echo "   ⚠️  Não foi possível criar via SSH, tentando via API..."
  
  # Tentar via API do relay
  curl -X POST http://localhost:3001/relay/exec \
    -H "Content-Type: application/json" \
    -d "{
      \"host\": \"$MIKROTIK\",
      \"user\": \"relay\",
      \"pass\": \"api2025\",
      \"command\": \"/ip/hotspot/active/add server=hotspot1 user=$USERNAME address=$IP mac-address=$MAC\"
    }" 2>/dev/null
  
  if [ $? -eq 0 ]; then
    echo "   ✅ Sessão ativa criada via API"
  else
    echo "   ❌ Erro ao criar sessão ativa"
  fi
fi

echo ""

# Verificar se funcionou
echo "3️⃣ Verificando sessão ativa:"
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 relay@$MIKROTIK \
  "/ip/hotspot/active/print where address=$IP or mac-address=$MAC" 2>/dev/null

echo ""
echo "✅ Processo concluído!"
echo "💡 Se não funcionou, pode ser necessário:"
echo "   1. Instalar sshpass: apt-get install sshpass"
echo "   2. Ou configurar chave SSH para relay@$MIKROTIK"
echo "   3. Ou usar o endpoint /api/liberar-acesso via API REST"

