#!/bin/bash
# Script para executar comandos no Mikrotik via relay (via VPS)
# Uso: bash exec-mikrotik.sh [Mikrotik IP] [Comando]
# Exemplo: bash exec-mikrotik.sh 10.200.200.7 "/file print where name~redirect"

RELAY_USER="relay"
RELAY_PASS="api2025"
VPS_HOST="67.211.212.18"
VPS_USER="root"

# Tenta adicionar a chave ao ssh-agent se não estiver
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
if [ -f "$SSH_KEY" ] && ! ssh-add -l 2>/dev/null | grep -q "$SSH_KEY"; then
    echo "🔑 Adicionando chave SSH ao ssh-agent..."
    ssh-add "$SSH_KEY" 2>/dev/null || true
fi

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "📋 Uso: bash exec-mikrotik.sh [Mikrotik IP] [Comando]"
    echo ""
    echo "💡 Exemplos:"
    echo "   bash exec-mikrotik.sh 10.200.200.7 \"/file print where name~redirect\""
    echo "   bash exec-mikrotik.sh 10.200.200.7 \"/ip hotspot profile print\""
    echo "   bash exec-mikrotik.sh 10.200.200.7 \"/ip hotspot active print\""
    exit 1
fi

MIKROTIK_IP="$1"
COMMAND="$2"

echo "🔌 Conectando ao Mikrotik $MIKROTIK_IP via VPS ($VPS_HOST)..."
echo "📝 Comando: $COMMAND"
echo ""

# Executa o comando via VPS (que tem acesso ao Mikrotik)
# Usa a chave SSH padrão do usuário
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"

if [ -f "$SSH_KEY" ]; then
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$VPS_USER@$VPS_HOST" \
        "sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        '$RELAY_USER@$MIKROTIK_IP' '$COMMAND'"
else
    # Tenta sem chave (vai pedir senha ou usar outra chave)
    ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        "$VPS_USER@$VPS_HOST" \
        "sshpass -p '$RELAY_PASS' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
        '$RELAY_USER@$MIKROTIK_IP' '$COMMAND'"
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Comando executado com sucesso!"
else
    echo ""
    echo "❌ Erro ao executar comando"
    exit 1
fi

