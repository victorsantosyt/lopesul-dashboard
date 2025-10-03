# Lopesul Dashboard - Integração Pagar.me + Mikrotik

Sistema completo de automação para hotspot com pagamento via PIX e liberação automática no Mikrotik.

**Otimizado para uso em frota de ônibus** com conexões instáveis e alto volume de transações.

## 🚀 Funcionalidades

### ✅ Sistema de Pagamentos
- Integração completa com Pagar.me
- Checkout com QR Code PIX
- Webhook para confirmação automática
- Validação de assinatura criptográfica
- **Cache inteligente de planos** (reduz chamadas à API)

### ✅ Controle de Hotspot
- Integração com API Mikrotik
- Liberação automática após pagamento
- Controle de sessões por tempo
- Desconexão automática ao expirar

### ✅ Dashboard Administrativo
- Monitoramento de pagamentos em tempo real
- Controle de sessões ativas
- Logs detalhados do sistema
- Estatísticas e métricas

### ✅ Automação Completa
- Liberação automática via webhook
- Expiração automática de sessões
- Monitoramento de saúde do sistema
- Processamento de pagamentos pendentes
- **Limpeza automática de dados antigos** (economiza espaço)

### ✅ Otimizações para Frota
- **Polling otimizado** (10s) para economizar bandwidth
- **Cache de planos** (5 minutos) reduz carga no servidor
- **UX melhorada** para uso em movimento
- **Verificação manual** com botão destacado
- **Countdown visual** mostrando próxima verificação
- **Logs detalhados** para debug e monitoramento

## 🛠️ Tecnologias

- **Frontend**: Next.js 15, React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Supabase
- **Pagamentos**: Pagar.me API
- **Hotspot**: Mikrotik RouterOS API
- **Banco de dados**: PostgreSQL (Supabase)

## 📋 Configuração

### Variáveis de Ambiente

\`\`\`env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Pagar.me
PAGAR_ME_API_KEY=your_pagar_me_api_key
PAGAR_ME_WEBHOOK_SECRET=your_webhook_secret

# Mikrotik
MIKROTIK_HOST=192.168.1.1
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=admin
MIKROTIK_PASSWORD=your_mikrotik_password

# Cron Jobs
CRON_SECRET=your_cron_secret
\`\`\`

### Banco de Dados

Execute os scripts SQL na pasta `/scripts` para criar as tabelas:

1. `001_create_payment_tables.sql` - Estrutura principal
2. `002_insert_sample_plans.sql` - Planos de exemplo
3. `003_execute_database_setup.sql` - Setup completo
4. `004_cleanup_old_data.sql` - Limpeza de dados antigos (executar semanalmente)

## 🔄 Fluxo de Automação

1. **Cliente acessa checkout** → Escolhe plano e preenche dados
2. **Sistema gera PIX** → Cria pedido no Pagar.me
3. **Cliente paga PIX** → Pagar.me confirma via webhook
4. **Liberação automática** → Sistema libera hotspot no Mikrotik
5. **Controle de tempo** → Desconecta automaticamente ao expirar

## 📊 APIs Disponíveis

### Pagamentos
- `POST /api/checkout` - Criar checkout
- `GET /api/payment/status/[id]` - Status do pagamento
- `POST /api/webhook/pagar-me` - Webhook Pagar.me

### Mikrotik
- `POST /api/mikrotik/release-hotspot` - Liberar acesso
- `POST /api/mikrotik/disconnect` - Desconectar usuário
- `POST /api/mikrotik/expire-sessions` - Expirar sessões

### Administração
- `POST /api/admin/automation` - Automação manual
- `POST /api/cron/expire-sessions` - Cron job de expiração

## 🚌 Otimizações para Frota de Ônibus

### Performance
- Cache de planos no localStorage (5 minutos)
- Polling otimizado (10s vs 5s) economiza 50% de bandwidth
- Headers de cache HTTP para planos
- Logs estruturados para debug rápido

### UX para Passageiros
- Interface simplificada e rápida
- Botão "Já Paguei? Verificar Agora" destacado
- Countdown visual mostrando próxima verificação
- Instruções claras de como pagar
- Feedback visual imediato

### Manutenção
- Script de limpeza automática de dados antigos
- Logs detalhados com prefixo `[v0]` para debug
- Tratamento robusto de erros
- Monitoramento de uso do banco

### Escalabilidade

**Plano Grátis Supabase:**
- 500MB de banco de dados
- 2GB de bandwidth/mês
- 50.000 usuários ativos/mês

**Estimativa de uso:**
- 10 ônibus × 40 passageiros/dia = 400 pagamentos/dia
- ~12.000 pagamentos/mês
- Plano grátis aguenta no início, mas monitore o uso

**Quando fazer upgrade:**
- Banco > 400MB (80% do limite)
- Bandwidth > 1.6GB/mês (80% do limite)
- Mais de 20 ônibus na frota

## 🎯 Próximos Passos

1. **Produção**: Configurar biblioteca real do Mikrotik (node-routeros)
2. **Monitoramento**: Implementar alertas por email/SMS
3. **Relatórios**: Dashboard com gráficos e métricas avançadas
4. **Mobile**: App mobile para gestão
5. **Multi-tenant**: Suporte a múltiplos estabelecimentos

## 🔧 Desenvolvimento

\`\`\`bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Build para produção
npm run build
\`\`\`

## 📝 Logs e Monitoramento

O sistema registra todos os eventos importantes:
- Criação de checkouts
- Confirmação de pagamentos
- Liberação de hotspot
- Desconexões e expirações
- Erros e falhas

Acesse `/dashboard` para monitorar tudo em tempo real.

## 🧹 Manutenção

### Limpeza de Dados Antigos

Execute o script `004_cleanup_old_data.sql` semanalmente para:
- Remover pagamentos expirados/cancelados (>90 dias)
- Limpar sessões antigas (>30 dias)
- Remover logs antigos (>30 dias)
- Recuperar espaço no banco

**Recomendação:** Configure um cron job no Supabase ou Vercel para executar automaticamente.
