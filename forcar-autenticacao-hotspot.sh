#!/bin/bash
# Script para forçar autenticação no hotspot (criar sessão ativa)
# Uso: ./forcar-autenticacao-hotspot.sh <IP> <MAC>

IP=${1:-"192.168.88.67"}
MAC=${2:-"24:29:34:91:1A:18"}
MIKROTIK="10.200.200.7"

echo "🔓 Forçando autenticação no hotspot..."
echo "   IP: $IP"
echo "   MAC: $MAC"
echo "   Mikrotik: $MIKROTIK"
echo ""

# Criar usuário temporário se não existir
USERNAME="user_${IP//./_}"
PASSWORD="temp123"

echo "1️⃣ Criando/verificando usuário no hotspot..."
sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no relay@$MIKROTIK << EOF
# Criar usuário se não existir
/ip/hotspot/user/add name=$USERNAME password=$PASSWORD profile=default
EOF

echo ""

# Criar sessão ativa no hotspot
echo "2️⃣ Criando sessão ativa no hotspot..."
sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no relay@$MIKROTIK << EOF
# Remover sessão antiga se existir
/ip/hotspot/active/remove [find address=$IP or mac-address=$MAC]

# Criar nova sessão ativa
/ip/hotspot/active/add server=hotspot1 user=$USERNAME address=$IP mac-address=$MAC
EOF

if [ $? -eq 0 ]; then
  echo "   ✅ Sessão ativa criada"
else
  echo "   ❌ Erro ao criar sessão ativa"
fi

echo ""

# Verificar se funcionou
echo "3️⃣ Verificando sessão ativa:"
sshpass -p 'api2025' ssh -o StrictHostKeyChecking=no relay@$MIKROTIK \
  "/ip/hotspot/active/print where address=$IP or mac-address=$MAC" 2>/dev/null

echo ""
echo "✅ Processo concluído!"
echo "💡 Cliente deve conseguir acessar agora"

