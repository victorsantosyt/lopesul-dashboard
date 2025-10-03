# Guia de Deploy - Sistema Pagar.me + MikroTik

Este guia contém todas as instruções para fazer deploy seguro do sistema em produção.

## 📋 Pré-requisitos

- [ ] Conta na Vercel
- [ ] Conta no Pagar.me (modo produção ativado)
- [ ] Banco de dados Supabase configurado
- [ ] MikroTik configurado e acessível

## 🔒 Segurança - ANTES de fazer push para GitHub

### 1. Verificar .gitignore

O arquivo `.gitignore` já está configurado para ignorar:
- Todos os arquivos `.env*`
- Credenciais e chaves de API
- Arquivos de configuração local

**Verifique se não há credenciais hardcoded no código:**

\`\`\`bash
# Buscar por possíveis credenciais no código
grep -r "sk_test_" .
grep -r "sk_live_" .
grep -r "password" . --include="*.ts" --include="*.tsx"
\`\`\`

### 2. Criar .env.example

Já criado! Use como template para configurar variáveis em outros ambientes.

## 🚀 Deploy na Vercel

### Passo 1: Push para GitHub

\`\`\`bash
git add .
git commit -m "Initial commit - Sistema Pagar.me + MikroTik"
git branch -M main
git remote add origin https://github.com/seu-usuario/seu-repo.git
git push -u origin main
\`\`\`

### Passo 2: Importar projeto na Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Clique em "Add New Project"
3. Importe seu repositório do GitHub
4. **NÃO faça deploy ainda** - configure as variáveis primeiro

### Passo 3: Configurar Variáveis de Ambiente

Na Vercel, vá em **Settings → Environment Variables** e adicione:

#### Supabase (já configurado via integração)
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- Variáveis do Postgres

#### Pagar.me - PRODUÇÃO ⚠️

**IMPORTANTE:** Use chaves de PRODUÇÃO, não de teste!

- `PAGAR_ME_API_KEY` = `sk_live_...` (não `sk_test_`)
- `NEXT_PUBLIC_PAGAR_ME_PUBLIC_KEY` = `pk_live_...` (não `pk_test_`)
- `PAGAR_ME_WEBHOOK_SECRET` = (gere um secret forte)

**Como obter as chaves de produção:**
1. Acesse [dashboard.pagar.me](https://dashboard.pagar.me)
2. Mude para **Modo Produção** (toggle no topo)
3. Vá em **Configurações → API Keys**
4. Copie a Secret Key (`sk_live_...`) e Public Key (`pk_live_...`)

#### MikroTik

- `MIKROTIK_HOST` = IP do seu MikroTik (ex: `192.168.88.1`)
- `MIKROTIK_USERNAME` = `admin` (ou seu usuário)
- `MIKROTIK_PASSWORD` = senha forte do MikroTik
- `MIKROTIK_PORT` = `8728` (porta da API)

### Passo 4: Deploy

1. Clique em **Deploy**
2. Aguarde o build completar (~2-3 minutos)
3. Anote a URL do deploy (ex: `seu-projeto.vercel.app`)

## 🗄️ Configurar Banco de Dados

### 1. Executar Scripts SQL

Acesse o Supabase SQL Editor e execute os scripts na ordem:

1. **001_create_payment_tables.sql** - Cria todas as tabelas
2. **002_insert_sample_plans.sql** - Insere planos de exemplo
3. **003_setup_rls_policies.sql** - Configura segurança RLS

**Link direto:** [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)

### 2. Verificar Tabelas

Confirme que as seguintes tabelas foram criadas:
- `plans`
- `payments`
- `hotspot_sessions`
- `system_logs`
- `mikrotik_config`
- `payment_logs`
- `webhook_logs`
- `session_logs`
- `admin_users`
- `dashboard_stats`

## 💳 Configurar Pagar.me

### 1. Ativar Modo Produção

1. Acesse [dashboard.pagar.me](https://dashboard.pagar.me)
2. Complete o cadastro da empresa (se ainda não fez)
3. Ative o **Modo Produção**

### 2. Habilitar PIX

1. Vá em **Configurações → Meios de Pagamento**
2. Procure por **PIX**
3. Clique em **Habilitar**
4. Complete as informações bancárias
5. Aguarde aprovação (pode levar algumas horas)

### 3. Configurar Webhook

1. Vá em **Configurações → Webhooks**
2. Clique em **Novo Webhook**
3. Configure:
   - **URL:** `https://seu-projeto.vercel.app/api/webhooks/pagarme`
   - **Versão:** v5
   - **Eventos:** Selecione todos os eventos de `order` e `charge`
   - **Secret:** Use o mesmo valor de `PAGAR_ME_WEBHOOK_SECRET`
4. Salve e teste o webhook

## 🌐 Configurar MikroTik

### 1. Habilitar API

```routeros
/ip service
set api address=0.0.0.0/0 disabled=no port=8728
