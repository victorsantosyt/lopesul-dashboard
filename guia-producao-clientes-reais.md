# Guia de Produção - Sistema em Uso com Clientes Reais

## 🎉 Parabéns! O sistema está funcionando em produção!

Agora que há clientes reais usando o sistema, aqui estão as recomendações essenciais:

## 📊 1. Monitoramento Contínuo

### Logs em Tempo Real
```bash
# Monitorar logs do dashboard
pm2 logs 4 --lines 0

# Monitorar logs do relay
pm2 logs mikrotik-relay --lines 0

# Verificar erros
pm2 logs 4 --err --lines 50
```

### Métricas Importantes
- **Pedidos por hora/dia**: Verificar se há picos ou problemas
- **Taxa de sucesso de pagamentos**: Quantos pagamentos são confirmados
- **Sessões ativas**: Quantos clientes estão usando a internet
- **Erros no sistema**: Verificar logs de erro regularmente

### Script de Monitoramento
```bash
# Criar um script que verifica o status a cada hora
*/60 * * * * cd /opt/lopesul-dashboard && node verificar-status.js
```

## 🔒 2. Backup e Segurança

### Backup do Banco de Dados
```bash
# Backup diário do PostgreSQL
# Adicionar ao crontab:
0 2 * * * pg_dump $DATABASE_URL > /backup/lopesul-dashboard-$(date +\%Y\%m\%d).sql
```

### Backup dos Códigos
- ✅ Código já está no GitHub (backup automático)
- Verificar se há variáveis sensíveis no `.env` que precisam ser documentadas

### Segurança
- [ ] Verificar se as senhas dos Mikrotiks estão seguras
- [ ] Verificar se o acesso SSH está restrito
- [ ] Verificar se as APIs estão protegidas (middleware)
- [ ] Considerar usar HTTPS para todas as comunicações

## 📈 3. Verificações Diárias

### Checklist Diário (Recomendado)
```bash
# 1. Verificar se os serviços estão rodando
pm2 list

# 2. Verificar pedidos recentes
cd /opt/lopesul-dashboard && node check-recent-pedidos.js

# 3. Verificar sessões ativas
cd /opt/lopesul-dashboard && node check-sessoes.js

# 4. Verificar erros nos logs
pm2 logs 4 --err --lines 100 --nostream | tail -20
```

### Verificações Semanais
- [ ] Verificar se todos os Mikrotiks estão online
- [ ] Verificar se há pedidos pendentes há muito tempo
- [ ] Verificar se há sessões expiradas que não foram removidas
- [ ] Verificar espaço em disco do servidor

## 🚨 4. Alertas e Notificações

### Configurar Alertas
- **Pedidos falhando**: Notificar se muitos pedidos estão falhando
- **Serviços offline**: Notificar se PM2 ou serviços caírem
- **Banco de dados**: Notificar se houver problemas de conexão
- **Mikrotiks offline**: Verificar se algum Mikrotik está inacessível

### Exemplo de Script de Alerta
```bash
# Verificar se os serviços estão rodando
if ! pm2 list | grep -q "online"; then
  # Enviar alerta (email, Telegram, etc.)
  echo "ALERTA: Serviços offline!"
fi
```

## 🔧 5. Manutenção Preventiva

### Atualizações
- [ ] Manter dependências atualizadas (npm audit)
- [ ] Atualizar o sistema operacional do servidor
- [ ] Verificar atualizações de segurança

### Limpeza de Dados
- [ ] Remover sessões expiradas antigas
- [ ] Arquivar pedidos antigos (se necessário)
- [ ] Limpar logs antigos

### Performance
- [ ] Monitorar uso de CPU e memória
- [ ] Verificar se há queries lentas no banco
- [ ] Otimizar índices do banco se necessário

## 📱 6. Comunicação com Clientes

### Suporte
- Documentar problemas comuns e soluções
- Criar FAQ para clientes
- Ter um canal de suporte (WhatsApp, email, etc.)

### Informações Úteis
- Como conectar no Wi-Fi
- Como fazer o pagamento
- Como resolver problemas comuns
- Tempo de expiração das sessões

## 📊 7. Relatórios e Análises

### Relatórios Diários
- Total de pedidos
- Total arrecadado
- Taxa de conversão (pedidos pagos vs pendentes)
- Clientes ativos

### Relatórios Semanais/Mensais
- Crescimento de vendas
- Dispositivos mais utilizados
- Horários de pico
- Problemas recorrentes

## 🛠️ 8. Scripts Úteis para Produção

### Verificar Status Geral
```bash
#!/bin/bash
echo "=== Status do Sistema ==="
echo ""
echo "📊 Serviços PM2:"
pm2 list
echo ""
echo "💾 Espaço em Disco:"
df -h
echo ""
echo "🔌 Conexões de Rede:"
netstat -an | grep ESTABLISHED | wc -l
```

### Verificar Pedidos Recentes
```bash
cd /opt/lopesul-dashboard && node check-recent-pedidos.js
```

### Verificar Sessões Ativas
```bash
cd /opt/lopesul-dashboard && node check-sessoes.js
```

## ⚠️ 9. Problemas Comuns e Soluções

### Serviço caiu
```bash
pm2 restart 4
pm2 restart mikrotik-relay
```

### Banco de dados lento
```bash
# Verificar conexões ativas
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

### Mikrotik não responde
```bash
# Verificar conectividade
ping 10.200.200.7
ssh relay@10.200.200.7 '/system resource print'
```

### Muitos pedidos pendentes
- Verificar se o webhook está funcionando
- Verificar logs do webhook
- Verificar se a API do Pagar.me está funcionando

## 📝 10. Documentação

### Manter Documentado
- [ ] Configuração de cada Mikrotik
- [ ] Credenciais importantes (em local seguro)
- [ ] Procedimentos de manutenção
- [ ] Contatos de emergência
- [ ] Histórico de problemas e soluções

## 🎯 Prioridades Imediatas

1. **✅ Configurar backup automático do banco de dados**
2. **✅ Criar script de monitoramento básico**
3. **✅ Documentar procedimentos de emergência**
4. **✅ Configurar alertas básicos**
5. **✅ Criar relatório diário de vendas**

## 🚀 Próximos Passos Sugeridos

1. **Dashboard de Monitoramento**: Criar uma página web para visualizar métricas
2. **API de Relatórios**: Criar endpoints para relatórios
3. **Notificações Automáticas**: Integrar com Telegram/Email para alertas
4. **Análise de Dados**: Criar gráficos de vendas e uso
5. **Otimizações**: Melhorar performance baseado em dados reais

---

**Lembre-se**: Com clientes reais, a estabilidade e confiabilidade são prioridades máximas!

