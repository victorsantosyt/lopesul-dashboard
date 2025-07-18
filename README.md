# 🚌 Lopesul Dashboard

Sistema de gerenciamento de acesso Wi-Fi para ônibus da Lopesul, integrado com Mikrotik e pagamentos via Pix.

---

## ✨ Visão Geral

O **Lopesul Dashboard** é uma plataforma web que permite gerenciar o acesso à internet nos ônibus da Lopesul, oferecendo planos de acesso temporário para passageiros, com pagamento automatizado via Pix e liberação instantânea do acesso após confirmação.

---

## 🚀 Funcionalidades

- Seleção de planos de acesso (12h, 24h, 48h)
- Geração automática de QR Code Pix para pagamento
- Validação automática do pagamento via backend
- Liberação do acesso no Mikrotik após confirmação do Pix
- Painel administrativo para gerenciamento de sessões e dispositivos (em desenvolvimento)
- Integração segura com banco de dados PostgreSQL (Railway)
- Estrutura pronta para deploy em Railway, Vercel, etc.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML, CSS puro, JavaScript Vanilla
- **Backend:** Next.js (API Routes), Node.js
- **Banco de Dados:** PostgreSQL (Railway)
- **Integração Mikrotik:** node-routeros
- **Pagamentos Pix:** Integração via API Pix e Webhook
- **ORM:** Prisma

---

## 📦 Instalação e Uso

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/lopesul-dashboard.git
cd lopesul-dashboard
