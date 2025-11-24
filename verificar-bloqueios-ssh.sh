#!/bin/bash
# Script para verificar bloqueios SSH no servidor
# Execute este script DENTRO do servidor (após conectar manualmente)

echo "🔍 Verificando bloqueios SSH..."
echo ""

# Verificar fail2ban
if command -v fail2ban-client &> /dev/null; then
    echo "📋 Status do fail2ban:"
    fail2ban-client status sshd 2>/dev/null || echo "  fail2ban não está bloqueando SSH"
    echo ""
fi

# Verificar iptables
echo "📋 Regras do iptables relacionadas a SSH:"
iptables -L INPUT -n | grep -E "(22|2222|DROP|REJECT)" | head -10 || echo "  Nenhuma regra específica encontrada"
echo ""

# Verificar logs de autenticação SSH recentes
echo "📋 Últimas tentativas de login SSH (últimas 20 linhas):"
tail -20 /var/log/auth.log 2>/dev/null || tail -20 /var/log/secure 2>/dev/null || echo "  Logs não encontrados"
echo ""

# Verificar se há muitos processos SSH pendentes
echo "📋 Conexões SSH ativas:"
ss -tn | grep :22 | wc -l
echo ""

echo "✅ Verificação concluída!"

