# Configuração do Captive Portal no Mikrotik

Este guia é para o **técnico responsável pelo Mikrotik** configurar o captive portal.

## 📋 Pré-requisitos

- Acesso admin ao Mikrotik via Winbox ou SSH
- Hotspot já configurado no Mikrotik
- Arquivo `captive-portal.html` (disponível em `/public/captive-portal.html`)

---

## 🔧 Passo a Passo

### 1. Acessar o Mikrotik

\`\`\`bash
# Via SSH
ssh admin@192.168.88.1

# Ou usar Winbox (interface gráfica)
\`\`\`

### 2. Fazer Upload do HTML

#### Opção A: Via Winbox
1. Abra o Winbox e conecte no Mikrotik
2. Vá em **Files**
3. Arraste o arquivo `captive-portal.html` para a janela
4. Aguarde o upload completar

#### Opção B: Via FTP
1. Habilite FTP no Mikrotik:
   \`\`\`
   /ip service enable ftp
   \`\`\`
2. Use um cliente FTP (FileZilla, WinSCP) para fazer upload
3. Conecte em `ftp://192.168.88.1`
4. Faça upload do `captive-portal.html`

#### Opção C: Via SCP (Linux/Mac)
\`\`\`bash
scp captive-portal.html admin@192.168.88.1:/
\`\`\`

### 3. Configurar o Hotspot para Usar o HTML

\`\`\`bash
# Acessar via SSH ou Terminal do Winbox
/ip hotspot walled-garden
add dst-host=v0-pagar-me-mikrotik-integration.vercel.app
add dst-host=*.vercel.app
add dst-host=pagar.me
add dst-host=*.pagar.me
add dst-host=*.pagarme.com.br

# Configurar o HTML customizado
/ip hotspot profile
set [find name=default] html-directory=hotspot login-by=http-pap
\`\`\`

### 4. Renomear o Arquivo HTML

O Mikrotik procura por um arquivo chamado `login.html` por padrão:

\`\`\`bash
/file
set captive-portal.html name=hotspot/login.html
\`\`\`

### 5. Configurar Walled Garden (Sites Permitidos)

Adicione os domínios que precisam funcionar ANTES do pagamento:

\`\`\`bash
/ip hotspot walled-garden
add dst-host=v0-pagar-me-mikrotik-integration.vercel.app comment="Sistema de Pagamento"
add dst-host=*.vercel.app comment="Vercel CDN"
add dst-host=pagar.me comment="Gateway de Pagamento"
add dst-host=*.pagarme.com.br comment="Pagar.me API"
add dst-host=api.pagar.me comment="Pagar.me API"
add dst-host=*.cloudflare.com comment="CDN"
add dst-host=*.google.com comment="Google (opcional)"
\`\`\`

### 6. Configurar IP Bindings (Whitelist)

Crie uma lista para IPs liberados após pagamento:

\`\`\`bash
/ip hotspot ip-binding
# A aplicação vai adicionar IPs aqui automaticamente via SSH
\`\`\`

### 7. Testar a Configuração

1. Conecte um dispositivo no WiFi
2. Tente acessar qualquer site
3. Deve aparecer a página do captive portal
4. Clique em "Comprar Acesso"
5. Deve redirecionar para a página de checkout

---

## 🔐 Configurar Acesso SSH (Para Automação)

A aplicação precisa de acesso SSH para liberar IPs automaticamente.

### 1. Criar Usuário para Automação

\`\`\`bash
/user add name=automation password=SenhaForte123! group=full
\`\`\`

### 2. Habilitar SSH

\`\`\`bash
/ip service
set ssh port=22 disabled=no
\`\`\`

### 3. Testar Conexão SSH

\`\`\`bash
# Do servidor da aplicação
ssh automation@192.168.88.1
\`\`\`

### 4. Fornecer Credenciais

Envie estas informações para quem vai configurar as variáveis de ambiente:

\`\`\`env
MIKROTIK_HOST=192.168.88.1
MIKROTIK_PORT=22
MIKROTIK_USERNAME=automation
MIKROTIK_PASSWORD=SenhaForte123!
\`\`\`

---

## 🧪 Testar Liberação Automática

### 1. Fazer um Pagamento de Teste

1. Conecte no WiFi
2. Acesse o captive portal
3. Faça um pagamento PIX de teste
4. Aguarde 5-10 segundos

### 2. Verificar se o IP Foi Liberado

\`\`\`bash
/ip hotspot ip-binding print
# Deve aparecer o IP do dispositivo que pagou
\`\`\`

### 3. Verificar Logs

\`\`\`bash
/log print where topics~"hotspot"
\`\`\`

---

## 🛠️ Troubleshooting

### Problema: Captive Portal Não Aparece

**Solução:**
\`\`\`bash
# Verificar se o hotspot está ativo
/ip hotspot print

# Verificar se o HTML está no lugar certo
/file print where name~"login.html"

# Recarregar configuração do hotspot
/ip hotspot profile
set [find name=default] html-directory=hotspot
\`\`\`

### Problema: Página de Checkout Não Carrega

**Solução:**
\`\`\`bash
# Adicionar domínio no walled garden
/ip hotspot walled-garden
add dst-host=v0-pagar-me-mikrotik-integration.vercel.app
\`\`\`

### Problema: Liberação Automática Não Funciona

**Solução:**
\`\`\`bash
# Verificar se SSH está habilitado
/ip service print

# Testar login SSH
ssh automation@192.168.88.1

# Verificar logs de erro
/log print where topics~"error"
\`\`\`

### Problema: Usuário Paga Mas Não Libera

**Solução:**
1. Verificar se o webhook está configurado no Pagar.me
2. Verificar logs da aplicação na Vercel
3. Testar liberação manual via API:
   \`\`\`bash
   curl -X POST https://v0-pagar-me-mikrotik-integration.vercel.app/api/pagamentos/liberar \
     -H "Content-Type: application/json" \
     -d '{"ip": "192.168.88.100", "mac": "AA:BB:CC:DD:EE:FF", "tempo": 60}'
   \`\`\`

---

## 📝 Checklist Final

- [ ] HTML do captive portal enviado para o Mikrotik
- [ ] Arquivo renomeado para `hotspot/login.html`
- [ ] Walled garden configurado com domínios necessários
- [ ] SSH habilitado e testado
- [ ] Usuário de automação criado
- [ ] Credenciais fornecidas para configurar variáveis de ambiente
- [ ] Teste completo realizado (pagamento → liberação)
- [ ] Logs verificados sem erros

---

## 🆘 Suporte

Se tiver problemas, verifique:
1. Logs do Mikrotik: `/log print`
2. Logs da aplicação na Vercel
3. Webhook configurado no Pagar.me
4. Variáveis de ambiente corretas

**Contato:** [Seu email/telefone de suporte]
