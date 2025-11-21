# 📊 Guia de Monitoramento do Sistema

## 🚀 Scripts Rápidos

### 1. Status Completo do Sistema (RECOMENDADO)
```bash
cd /opt/lopesul-dashboard
node status-sistema-completo.js
```

Ou use o script shell:
```bash
./ver-status.sh
```

**O que mostra:**
- ✅ Status do Relay (online/offline)
- 👥 Clientes conectados AGORA
- 💰 Últimos pagamentos (última hora)
- 📅 Pagamentos de hoje (total e receita)
- 📋 Últimas sessões (últimas 24h)
- 🚌 Dispositivos/Roteadores cadastrados
- 🚨 Alertas e problemas

### 2. Ver Logs do Mikrotik
```bash
# Rápido (essencial)
./ver-logs-mikrotik-rapido.sh 10.200.200.7

# Completo (todos os detalhes)
./ver-logs-mikrotik-completo.sh 10.200.200.7

# Via Node.js (por mikId)
node ver-logs-mikrotik.js LOPESUL-HOTSPOT-06
```

**O que mostra:**
- Sessões ativas do hotspot
- Clientes na lista `paid_clients`
- IP bindings (bypassed)
- Logs recentes do hotspot

### 3. Monitorar em Tempo Real

#### Dashboard Logs
```bash
pm2 logs 4 --lines 0 --raw | grep -E "(Portal|detect-client|checkout|webhook|MIKROTIK|deviceIdentifier|deviceId|mikId|QR|Erro|ERROR)"
```

#### Relay Logs
```bash
pm2 logs mikrotik-relay --lines 0 --raw
```

#### Status Atualizado Automaticamente
```bash
watch -n 30 "node status-sistema-completo.js"
```
(Atualiza a cada 30 segundos)

## 📋 Checklist Diário

Execute este comando para ver tudo de uma vez:

```bash
cd /opt/lopesul-dashboard && \
echo "=== STATUS DO SISTEMA ===" && \
node status-sistema-completo.js && \
echo "" && \
echo "=== LOGS DO MIKROTIK ===" && \
./ver-logs-mikrotik-rapido.sh 10.200.200.7
```

## 🔍 Verificações Específicas

### Verificar se um cliente específico está conectado
```bash
node verificar-e-reativar-sessao.js <IP>
```

### Verificar pedidos de um cliente
```bash
node verificar-pedidos-cliente.js <MAC ou IP>
```

### Liberar acesso manual (cortesia)
```bash
./liberar-cliente-cortesia.sh <IP> <MAC> [mikId]
```

## 🚨 Quando Algo Está Errado

### Cliente pagou mas não tem acesso
1. Verificar se o pedido está `PAID`:
   ```bash
   node verificar-pedidos-cliente.js <MAC>
   ```

2. Verificar se há sessão ativa:
   ```bash
   node verificar-e-reativar-sessao.js <IP>
   ```

3. Se não houver sessão, liberar manualmente:
   ```bash
   ./liberar-cliente-cortesia.sh <IP> <MAC> LOPESUL-HOTSPOT-06
   ```

### Relay está offline
```bash
# Verificar logs do relay
pm2 logs mikrotik-relay --lines 50 --nostream

# Reiniciar relay
pm2 restart mikrotik-relay
```

### Dashboard não responde
```bash
# Verificar logs
pm2 logs 4 --lines 50 --nostream

# Reiniciar dashboard
pm2 restart 4
```

## 📊 Métricas Importantes

### Receita de Hoje
O script `status-sistema-completo.js` mostra automaticamente a receita do dia.

### Clientes Conectados Agora
Verifique a seção "SESSÕES ATIVAS" no status completo.

### Taxa de Conversão
Compare:
- Total de pedidos criados hoje
- Total de pedidos pagos hoje
- Diferença = taxa de abandono

## 💡 Dicas

1. **Execute o status completo pelo menos 2x por dia** para acompanhar o sistema
2. **Use `watch` para monitoramento contínuo** quando estiver ativo
3. **Verifique os alertas** - eles indicam problemas que precisam atenção
4. **Mantenha os logs do Mikrotik limpos** - muitos IPs antigos podem indicar necessidade de limpeza

## 🆘 Comandos de Emergência

### Sistema completamente parado
```bash
pm2 restart all
```

### Limpar sessões expiradas
```bash
# Verificar sessões expiradas
node status-sistema-completo.js | grep "sessão.*expirada"

# Limpar manualmente (se necessário)
# (criar script específico se precisar)
```

### Backup do banco
```bash
./fazer-backup-banco.sh
```

