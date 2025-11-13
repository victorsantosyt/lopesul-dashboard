# 🔧 Como Consertar o Hotspot 100%

## Problema Identificado

O cliente está pagando mas **não recebe acesso** porque:
1. ❌ O arquivo `redirect.html` **NÃO está no MikroTik**
2. ❌ Por isso, o MAC e IP não são passados para o portal
3. ❌ Sem MAC e IP, o sistema não consegue autenticar o cliente no hotspot

## Solução (PASSO A PASSO)

### 1️⃣  Criar o Arquivo redirect.html

Crie um arquivo chamado `redirect.html` com este conteúdo EXATO:

```html
<html>
<head>
<meta http-equiv="refresh" content="0; url=https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=$(mac)&ip=$(ip)&link-orig=$(link-orig-esc)">
<title>Redirecionando...</title>
</head>
<body>
<h2>Aguarde, redirecionando para o portal de pagamento...</h2>
</body>
</html>
```

### 2️⃣  Fazer Upload para o MikroTik

**Opção A - Via Winbox:**
1. Abra o Winbox e conecte no MikroTik
2. Menu: **Files**
3. Clique em **Upload**
4. Selecione o arquivo `redirect.html`
5. Após upload, **arraste** o arquivo para a pasta `hotspot/`
6. Renomeie para garantir: `hotspot/redirect.html`

**Opção B - Via WebFig (Web):**
1. Acesse: http://IP_DO_MIKROTIK
2. Login: admin (sem senha ou com sua senha)
3. Menu: **Files**
4. Clique em **Upload**
5. Selecione `redirect.html`
6. Após upload, mova para `hotspot/redirect.html`

**Opção C - Via FTP:**
```bash
# Na VPS
cat > /tmp/redirect.html << 'EOF'
<html>
<head>
<meta http-equiv="refresh" content="0; url=https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=$(mac)&ip=$(ip)&link-orig=$(link-orig-esc)">
<title>Redirecionando...</title>
</head>
<body>
<h2>Aguarde, redirecionando para o portal de pagamento...</h2>
</body>
</html>
EOF

# Upload via FTP
ftp 10.200.200.2
# login: admin
# password: (pressione Enter se não tiver senha)
# bin
# cd hotspot
# put /tmp/redirect.html redirect.html
# bye
```

### 3️⃣  Verificar se Funcionou

1. **Conecte um celular no WiFi do ônibus**
2. **Tente acessar**: http://neverssl.com
3. **Deve redirecionar automaticamente** para:
   ```
   https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=XX:XX:XX&ip=192.168.88.X
   ```
4. **Importante**: Verifique que a URL TEM os parâmetros `?mac=` e `&ip=`

### 4️⃣  Testar Pagamento Completo

1. No portal, escolha um plano
2. Gere o QR Code Pix
3. Pague usando seu celular
4. **Aguarde ~20 segundos**
5. ✅ Acesso deve ser liberado automaticamente!

## Verificação Rápida

Execute este comando na VPS para verificar se tudo está ok:

```bash
ssh root@67.211.212.18 'curl -s "https://painel.lopesuldashboardwifi.com/api/db-health"'
```

Deve retornar: `{"ok":true}`

## Monitoramento

Para ver os logs em tempo real quando alguém pagar:

```bash
ssh root@67.211.212.18 'pm2 logs lopesul-painel --lines 50'
```

Busque por estas mensagens:
```
[webhook] Pedido encontrado: { ip: '192.168.88.X', mac: 'XX:XX:XX:XX:XX:XX' }
[liberarClienteNoMikrotik] 1/2 Criando usuário
[liberarClienteNoMikrotik] 2/2 Autenticando cliente
[liberarClienteNoMikrotik] Cliente autenticado no hotspot! Acesso liberado.
```

## Checklist Final

- [ ] redirect.html criado com conteúdo correto
- [ ] Arquivo enviado para `hotspot/redirect.html` no MikroTik
- [ ] Perfil hotspot-lopesul usa `html-directory=hotspot`
- [ ] Walled garden permite cativo.lopesuldashboardwifi.com
- [ ] Testado: celular conectado → acessa HTTP → redireciona com MAC/IP
- [ ] Testado: pagar Pix → aguardar → acesso liberado automaticamente

## Troubleshooting

### redirect.html não está funcionando

```bash
# Verificar se o arquivo existe no MikroTik
ssh -p 2222 admin@67.211.212.18 '/file print where name~"redirect"'
```

### MAC/IP ainda não aparecem na URL

- Verifique se o perfil hotspot está usando o html-directory correto:
  ```bash
  ssh -p 2222 admin@67.211.212.18 '/ip hotspot profile print'
  ```
- Deve mostrar: `html-directory: hotspot`

### Cliente paga mas não libera

1. Verifique os logs: `ssh root@67.211.212.18 'pm2 logs lopesul-painel | grep webhook'`
2. Se aparecer "MAC ou IP ausente" → problema no redirect.html
3. Se aparecer "Cliente autenticado no hotspot!" → sistema está funcionando 100%

## Sistema 100% Funcional Quando

✅ Cliente conecta no WiFi  
✅ Tenta acessar qualquer site HTTP  
✅ É redirecionado para portal com `?mac=XX&ip=192.168.88.X`  
✅ Escolhe plano e paga via Pix  
✅ Webhook recebe confirmação do Pagar.me  
✅ Sistema cria usuário E autentica no hotspot  
✅ Cliente tem acesso à internet IMEDIATAMENTE  

---

**ATENÇÃO**: O passo CRÍTICO é o arquivo `redirect.html` no MikroTik!
Sem ele, o sistema nunca vai funcionar 100% porque não terá MAC/IP.
