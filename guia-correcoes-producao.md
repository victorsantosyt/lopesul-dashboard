# Guia: Como Corrigir Problemas em Produção (Com Clientes Reais)

## 🚨 Processo Seguro para Correções em Produção

### ⚠️ REGRA DE OURO: **NUNCA CORRIGIR DIRETO EM PRODUÇÃO SEM TESTAR PRIMEIRO!**

## 📋 Processo Recomendado (Passo a Passo)

### 1. **Diagnosticar o Problema**

#### A. Coletar Informações
```bash
# Ver logs do problema específico
pm2 logs 4 --lines 200 --nostream | grep -i "erro\|error\|falha\|problem"

# Verificar pedidos/sessões relacionados
cd /opt/lopesul-dashboard && node verificar-status-producao.js

# Verificar logs do webhook (se for problema de pagamento)
pm2 logs 4 --lines 100 --nostream | grep -i "webhook\|pagarme"
```

#### B. Reproduzir Localmente (se possível)
- Tentar reproduzir o problema em ambiente de desenvolvimento
- Entender a causa raiz do problema
- Verificar se é um problema pontual ou sistemático

#### C. Identificar Impacto
- Quantos clientes foram afetados?
- O problema está acontecendo agora ou foi pontual?
- O problema impede o funcionamento ou é apenas um inconveniente?

### 2. **Criar Correção Localmente**

#### A. Desenvolver a Correção
- Fazer a correção no código local
- Testar a correção localmente
- Verificar se não quebra outras funcionalidades

#### B. Criar Testes (se possível)
- Testar cenários similares ao problema
- Verificar edge cases
- Testar com dados similares aos de produção

### 3. **Revisar a Correção**

#### A. Checklist Antes de Deploy
- [ ] A correção resolve o problema?
- [ ] Não quebra funcionalidades existentes?
- [ ] Não afeta clientes que estão usando o sistema agora?
- [ ] A correção é reversível (pode voltar atrás se der problema)?
- [ ] Há rollback plan (plano de volta atrás)?

#### B. Documentar a Correção
- O que foi corrigido?
- Por que o problema aconteceu?
- Como a correção funciona?
- Como testar se funcionou?

### 4. **Deploy Seguro em Produção**

#### A. Preparar o Deploy
```bash
# 1. Fazer backup do banco ANTES de qualquer mudança
pg_dump $DATABASE_URL > /backup/backup-antes-correcao-$(date +\%Y\%m\%d-%H\%M).sql

# 2. Verificar status atual
pm2 list
cd /opt/lopesul-dashboard && node verificar-status-producao.js

# 3. Fazer commit e push da correção
git add .
git commit -m "fix: [descrição do problema corrigido]"
git push
```

#### B. Deploy em Horário de Baixo Tráfego (se possível)
- Se o problema não for crítico, aguardar horário de menor uso
- Se for crítico, fazer imediatamente mas com cuidado

#### C. Deploy Passo a Passo
```bash
# 1. No servidor, fazer pull
cd /opt/lopesul-dashboard
git pull

# 2. Verificar se não há conflitos
git status

# 3. Instalar dependências (se houver novas)
npm install

# 4. Gerar Prisma Client (se schema mudou)
npx prisma generate

# 5. Fazer build
npm run build

# 6. Verificar se build foi bem-sucedido
# (se der erro, NÃO reiniciar o serviço!)

# 7. Reiniciar serviços (um de cada vez)
pm2 restart 4
# Aguardar alguns segundos e verificar
pm2 logs 4 --lines 20 --nostream

# Se houver relay:
pm2 restart mikrotik-relay
pm2 logs mikrotik-relay --lines 20 --nostream
```

### 5. **Monitorar Após Deploy**

#### A. Verificar Logs Imediatamente
```bash
# Ver logs em tempo real
pm2 logs 4 --lines 0

# Verificar se há erros
pm2 logs 4 --err --lines 50
```

#### B. Testar Funcionalidade Corrigida
- Testar o fluxo que estava com problema
- Verificar se agora funciona corretamente
- Monitorar por alguns minutos

#### C. Verificar Impacto Geral
```bash
# Verificar status geral
cd /opt/lopesul-dashboard && node verificar-status-producao.js

# Verificar se novos pedidos estão funcionando
pm2 logs 4 --lines 50 --nostream | grep -i "checkout\|pedido"
```

### 6. **Plano de Rollback (Volta Atrás)**

#### Se Algo Der Errado:
```bash
# 1. PARAR IMEDIATAMENTE se houver problema crítico
pm2 stop 4

# 2. Voltar para versão anterior
cd /opt/lopesul-dashboard
git log --oneline -5  # Ver commits recentes
git checkout <commit-anterior>  # Voltar para commit anterior

# 3. Rebuild e restart
npm run build
pm2 restart 4

# 4. Restaurar banco se necessário (CUIDADO!)
# pg_restore /backup/backup-antes-correcao-YYYYMMDD-HHMM.sql
```

## 🔧 Estratégias de Correção por Tipo de Problema

### Problema Crítico (Sistema Parado)
1. **Diagnosticar rapidamente** (5-10 minutos)
2. **Criar correção mínima** (hotfix)
3. **Deploy imediato** (com backup antes)
4. **Monitorar de perto** após deploy
5. **Refatorar depois** (correção melhor quando sistema estiver estável)

### Problema Moderado (Funcionalidade Quebrada)
1. **Diagnosticar completamente** (entender causa raiz)
2. **Criar correção adequada** (não apenas remendo)
3. **Testar bem localmente**
4. **Deploy em horário de baixo tráfego** (se possível)
5. **Monitorar após deploy**

### Problema Menor (Bug/Inconveniente)
1. **Documentar o problema**
2. **Criar correção completa**
3. **Testar extensivamente**
4. **Deploy no próximo ciclo de atualização**
5. **Monitorar após deploy**

## 📝 Checklist de Segurança

Antes de qualquer deploy em produção:

- [ ] **Backup do banco de dados feito**
- [ ] **Código testado localmente**
- [ ] **Build funciona sem erros**
- [ ] **Plano de rollback definido**
- [ ] **Horário adequado escolhido** (se não for crítico)
- [ ] **Monitoramento ativo após deploy**
- [ ] **Comunicação com equipe** (se houver)

## 🚨 Sinais de Alerta - PARAR IMEDIATAMENTE

Se após deploy você ver:
- ❌ Erros em cascata nos logs
- ❌ Serviço não inicia
- ❌ Muitos clientes reclamando
- ❌ Banco de dados com problemas
- ❌ Sistema completamente parado

**AÇÃO IMEDIATA:**
```bash
# Parar serviços
pm2 stop 4
pm2 stop mikrotik-relay

# Voltar código anterior
cd /opt/lopesul-dashboard
git checkout HEAD~1  # Voltar 1 commit
npm run build
pm2 restart 4
```

## 💡 Boas Práticas

### 1. **Sempre Fazer Backup Antes**
```bash
# Backup automático antes de mudanças
pg_dump $DATABASE_URL > /backup/backup-$(date +\%Y\%m\%d-%H\%M).sql
```

### 2. **Usar Branches para Correções**
```bash
# Criar branch para hotfix
git checkout -b hotfix/nome-do-problema
# Fazer correção
git commit -m "fix: ..."
git push origin hotfix/nome-do-problema
# Merge depois de testado
```

### 3. **Documentar Tudo**
- O que foi corrigido
- Por que foi necessário
- Como testar
- Lições aprendidas

### 4. **Testar em Staging Primeiro** (se tiver)
- Ambiente de staging similar a produção
- Testar correção lá primeiro
- Depois fazer deploy em produção

### 5. **Deploy Gradual** (se possível)
- Deploy para um Mikrotik primeiro
- Testar
- Se funcionar, deploy para os outros

## 📊 Monitoramento Pós-Correção

### Primeiras 24 horas:
- Monitorar logs constantemente
- Verificar métricas (pedidos, sessões, erros)
- Estar disponível para rollback rápido

### Primeira semana:
- Verificar se problema não voltou
- Verificar se não criou novos problemas
- Coletar feedback de clientes

## 🎯 Resumo: Processo Seguro

1. **Diagnosticar** → Entender o problema
2. **Corrigir Localmente** → Testar bem
3. **Backup** → Sempre antes de mudanças
4. **Deploy Cuidadoso** → Passo a passo
5. **Monitorar** → Acompanhar de perto
6. **Documentar** → Para não repetir erros

---

**Lembre-se**: Em produção com clientes reais, **estabilidade > velocidade**. É melhor fazer certo do que fazer rápido!

