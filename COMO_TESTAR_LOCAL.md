# 🧪 Como Testar Localmente

## 1. Instalar dependências (se ainda não instalou)
```bash
npm install
```

## 2. Configurar variáveis de ambiente (se necessário)
Crie um arquivo `.env.local` na raiz do projeto com as variáveis necessárias:
```bash
DATABASE_URL="sua_url_do_banco"
# Outras variáveis se necessário
```

## 3. Rodar o servidor de desenvolvimento
```bash
npm run dev
```

O servidor vai iniciar em: **http://localhost:3000**

## 4. Acessar a página de pagamento
Abra no navegador:
```
http://localhost:3000/pagamento.html
```

Ou com parâmetros de teste:
```
http://localhost:3000/pagamento.html?ip=192.168.88.50&mac=AA:BB:CC:DD:EE:FF&deviceId=TESTE
```

## 5. Testar o formulário
1. Escolha um plano (12h, 24h ou 48h)
2. Preencha o **Nome completo** (obrigatório, mínimo 3 caracteres)
3. Preencha o **CPF ou CNPJ** (obrigatório)
4. Clique em "Gerar QR Pix"

## ⚠️ Notas
- O servidor precisa estar rodando (`npm run dev`)
- A página está em `public/pagamento.html`
- As mudanças no HTML são visíveis imediatamente (sem rebuild)
- Para testar a API de checkout, você precisará das variáveis de ambiente configuradas (PAGARME_SECRET_KEY, etc.)
