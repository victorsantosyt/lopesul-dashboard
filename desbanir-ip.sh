#!/bin/bash
# Script para desbanir IPs do fail2ban
# Uso: bash desbanir-ip.sh [IP]

if [ -z "$1" ]; then
    echo "📋 IPs atualmente banidos pelo fail2ban:"
    fail2ban-client status sshd | grep "Banned IP list" | cut -d: -f2 | tr ',' '\n' | sed 's/^/  - /'
    echo ""
    echo "💡 Para desbanir um IP, execute:"
    echo "   bash desbanir-ip.sh [IP]"
    echo ""
    echo "💡 Exemplo:"
    echo "   bash desbanir-ip.sh 101.36.126.138"
    exit 0
fi

IP="$1"

if command -v fail2ban-client &> /dev/null; then
    echo "🔓 Desbanindo IP: $IP"
    fail2ban-client set sshd unbanip "$IP"
    
    if [ $? -eq 0 ]; then
        echo "✅ IP $IP desbanido com sucesso!"
        echo ""
        echo "📋 IPs ainda banidos:"
        fail2ban-client status sshd | grep "Banned IP list" | cut -d: -f2 | tr ',' '\n' | sed 's/^/  - /'
    else
        echo "❌ Erro ao desbanir IP $IP"
    fi
else
    echo "❌ fail2ban-client não encontrado"
fi

