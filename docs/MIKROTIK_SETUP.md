# Configuração do MikroTik para Captive Portal

Este guia explica como configurar o MikroTik RouterOS para usar o sistema de pagamento via PIX.

## Pré-requisitos

- MikroTik RouterOS 6.x ou superior
- Acesso administrativo ao MikroTik (via Winbox ou SSH)
- Hotspot já configurado no MikroTik

## Passo 1: Configurar Walled Garden

O Walled Garden permite que usuários não autenticados acessem URLs específicas (seu sistema de pagamento).

\`\`\`bash
/ip hotspot walled-garden
add dst-host=v0-pagar-me-mikrotik-integration.vercel.app comment="Sistema de Pagamento"
add dst-host=*.vercel.app comment="Vercel CDN"
add dst-host=api.pagar.me comment="Pagar.me API"
add dst-host=*.pagarme.com.br comment="Pagar.me"
\`\`\`

## Passo 2: Configurar Página de Login Personalizada

### Opção A: Via FTP (Recomendado)

1. Habilite o serviço FTP no MikroTik:
\`\`\`bash
/ip service
set ftp disabled=no
\`\`\`

2. Conecte via FTP:
   - Host: IP do MikroTik
   - Usuário: admin
   - Senha: sua senha admin
   - Porta: 21

3. Navegue até a pasta `/hotspot/`

4. Faça upload do arquivo `captive-portal.html` renomeando para `login.html`

5. Desabilite o FTP após o upload:
\`\`\`bash
/ip service
set ftp disabled=yes
\`\`\`

### Opção B: Via Terminal

\`\`\`bash
/file
print
# Copie o arquivo login.html para o MikroTik
\`\`\`

## Passo 3: Configurar Redirecionamento

Configure o hotspot para usar a página personalizada:

\`\`\`bash
/ip hotspot profile
set [find] html-directory=hotspot login-by=http-pap
\`\`\`

## Passo 4: Configurar API do MikroTik

Crie um usuário específico para a API:

\`\`\`bash
/user
add name=api-automation password=SuaSenhaForte123! group=full comment="API Automation User"
\`\`\`

## Passo 5: Habilitar API

\`\`\`bash
/ip service
set api disabled=no port=8728
set api-ssl disabled=no port=8729
\`\`\`

## Passo 6: Configurar Firewall Address List

Crie a lista que será usada para liberar acesso:

\`\`\`bash
/ip firewall address-list
add list=hotspot-allowed comment="Usuarios com acesso liberado"
\`\`\`

## Passo 7: Regra de Firewall

Adicione regra para permitir acesso da lista:

\`\`\`bash
/ip firewall filter
add chain=forward src-address-list=hotspot-allowed action=accept comment="Hotspot Paid Users" place-before=0
\`\`\`

## Passo 8: Configurar Variáveis de Ambiente

No seu projeto Vercel, configure:

\`\`\`env
MIKROTIK_HOST=192.168.88.1
MIKROTIK_PORT=8728
MIKROTIK_USERNAME=api-automation
MIKROTIK_PASSWORD=SuaSenhaForte123!
\`\`\`

## Teste de Configuração

1. Conecte um dispositivo ao WiFi
2. Você deve ser redirecionado para a página de pagamento
3. Após o pagamento, o acesso deve ser liberado automaticamente

## Troubleshooting

### Página não carrega
- Verifique se o Walled Garden está configurado corretamente
- Teste acessando diretamente: `http://192.168.88.1/login.html`

### Pagamento não libera acesso
- Verifique os logs do MikroTik: `/log print`
- Verifique se a API está habilitada
- Teste a conexão API manualmente

### Erro de autenticação API
- Verifique usuário e senha nas variáveis de ambiente
- Confirme que o usuário tem permissões `full`

## Comandos Úteis

\`\`\`bash
# Ver usuários conectados
/ip hotspot active print

# Ver address-list
/ip firewall address-list print where list=hotspot-allowed

# Ver logs
/log print where topics~"hotspot"

# Limpar cache
/ip hotspot active remove [find]
\`\`\`

## Segurança

1. **Sempre use senha forte** para o usuário da API
2. **Desabilite FTP** após configurar
3. **Use API-SSL** (porta 8729) em produção
4. **Limite acesso** à API por IP se possível:

\`\`\`bash
/ip firewall filter
add chain=input protocol=tcp dst-port=8728 src-address=SEU_IP_SERVIDOR action=accept
add chain=input protocol=tcp dst-port=8728 action=drop
\`\`\`

## Próximos Passos

- Configure backup automático do MikroTik
- Monitore logs regularmente
- Teste o fluxo completo antes de colocar em produção
