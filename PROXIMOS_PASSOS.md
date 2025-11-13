# 🚀 Próximos Passos - Sistema Lopesul WiFi

**Status atual**: ✅ Infraestrutura 100% operacional  
**Falta apenas**: Configurar Hotspot no MikroTik

---

## ✅ O que JÁ está funcionando:

### Infraestrutura
- ✅ VPS configurada (67.211.212.18)
- ✅ Túnel WireGuard conectado (0% packet loss)
- ✅ Painel: https://painel.lopesuldashboardwifi.com
- ✅ Portal: https://cativo.lopesuldashboardwifi.com/pagamento.html
- ✅ Banco Railway conectado
- ✅ Chave Pagar.me configurada: `sk_3d3bce2771e84ac1a16641ab9184f2dc`

### Conectividade
- ✅ SSH MikroTik: `ssh -p 2222 admin@67.211.212.18`
- ✅ API MikroTik acessível (porta 28728)
- ✅ Usuário API: `relay / api2025`

---

## 📋 PASSO 1: Configurar Hotspot no MikroTik

Execute o arquivo **`CONFIGURAR_HOTSPOT_MIKROTIK.rsc`** no MikroTik.

Isso irá:
1. Criar perfil de hotspot
2. Configurar pool de IPs (192.168.88.10-254)
3. Ativar portal cativo na interface bridge
4. Adicionar walled garden (sites permitidos)
5. Redirecionar clientes para o portal de pagamento

**Como executar:**
```bash
# Conectar no MikroTik
ssh -p 2222 admin@67.211.212.18

# Copiar e colar o conteúdo do arquivo CONFIGURAR_HOTSPOT_MIKROTIK.rsc
```

**OU via WinBox:**
1. Abra WinBox
2. Conecte no MikroTik
3. Vá em **System → Scripts**
4. Clique em **+** (Add New)
5. Cole o conteúdo do arquivo
6. Clique em **Run Script**

---

## 📋 PASSO 2: Personalizar página de login (OPCIONAL)

Por padrão, o MikroTik mostra uma página de login genérica. Para redirecionar direto para seu portal:

### Opção A: Criar arquivo login.html customizado

1. **Conecte via WinBox**
2. **Files → hotspot/**
3. **Crie arquivo `login.html`** com este conteúdo:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Redirecionando...</title>
    <script>
        // Pegar MAC do cliente
        var mac = "$(mac)";
        var ip = "$(ip)";
        
        // Redirecionar para portal de pagamento
        window.location.href = "https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=" + mac + "&ip=" + ip;
    </script>
</head>
<body>
    <p>Redirecionando para pagamento...</p>
</body>
</html>
```

### Opção B: Usar redirecionamento HTTP direto

Execute no MikroTik:
```routeros
/ip hotspot profile set hotspot-lopesul \
    http-cookie-lifetime=3d \
    login-by=http-pap
```

---

## 📋 PASSO 3: Testar o fluxo completo

### 1. Conectar cliente no WiFi
- SSID: [Nome do WiFi do MikroTik]
- Senha: [Senha WiFi]

### 2. Tentar acessar qualquer site
- Cliente será redirecionado para: https://cativo.lopesuldashboardwifi.com/pagamento.html

### 3. Simular pagamento
- Escolher plano (12h, 24h, 48h)
- Gerar QR Code Pix
- Fazer pagamento

### 4. Verificar liberação
Após pagamento confirmado:
- Sistema deve liberar o MAC do cliente automaticamente
- Cliente poderá navegar livremente

---

## 📋 PASSO 4: Criar usuário admin no painel

1. Acesse: https://painel.lopesuldashboardwifi.com
2. Faça cadastro/login
3. Configure:
   - Frotas (ônibus)
   - Dispositivos (MikroTiks)
   - Operadores (usuários admin)

---

## 🔧 Comandos úteis para debug

### Ver clientes conectados (MikroTik)
```routeros
# Ver todos os clientes DHCP
/ip dhcp-server lease print

# Ver clientes ativos no hotspot
/ip hotspot active print

# Ver clientes autorizados
/ip hotspot host print
```

### Liberar MAC manualmente (teste)
```routeros
# Adicionar cliente ao bypass (para testar sem pagar)
/ip hotspot host add mac-address=AA:BB:CC:DD:EE:FF address=192.168.88.100

# Ou criar usuário temporário
/ip hotspot user add name=teste password=teste profile=default
```

### Ver logs de pagamento (VPS)
```bash
# Logs do painel
ssh root@67.211.212.18 'pm2 logs lopesul-painel --lines 100'

# Logs do relay
ssh root@67.211.212.18 'pm2 logs mikrotik-relay --lines 100'

# Logs do Nginx
ssh root@67.211.212.18 'tail -f /var/log/nginx/access.log'
```

### Testar API do MikroTik
```bash
# Da VPS, testar conexão
ssh root@67.211.212.18 'nc -zv 10.200.200.2 8728'

# Testar SSH
ssh -p 2222 relay@67.211.212.18 '/system resource print'
```

---

## 🆘 Troubleshooting

### Cliente não é redirecionado
1. Verificar se hotspot está ativo: `/ip hotspot print`
2. Ver logs: `/log print where message~"hotspot"`
3. Verificar DNS: `/ip dns print`

### Pagamento não libera acesso
1. Ver webhook Pagar.me chegando: `pm2 logs lopesul-painel`
2. Verificar relay conectando no MikroTik: `pm2 logs mikrotik-relay`
3. Ver se MAC foi adicionado: `/ip hotspot host print`

### Túnel WireGuard cai
1. Ver status: `wg show` (na VPS)
2. Verificar handshake: `/interface wireguard peers print` (MikroTik)
3. Reiniciar: `systemctl restart wg-quick@wg-vps` (VPS)

---

## 📞 Arquivos de referência

- **SISTEMA_PRONTO.md** - Status completo do sistema
- **CONFIGURACAO_COMPLETA.md** - Todas as credenciais e configs
- **CONFIGURAR_MIKROTIK_COMPLETO.rsc** - Config básica MikroTik
- **CONFIGURAR_HOTSPOT_MIKROTIK.rsc** - Config hotspot (portal cativo)

---

## ✅ Checklist final

- [ ] Executar script de hotspot no MikroTik
- [ ] Personalizar página de login (opcional)
- [ ] Testar redirecionamento de cliente
- [ ] Simular pagamento Pix
- [ ] Verificar liberação automática
- [ ] Criar usuário admin no painel
- [ ] Cadastrar frota e dispositivos
- [ ] Testar em produção com cliente real

---

**Após completar estes passos, o sistema estará 100% pronto para uso em produção!** 🎉

Em caso de dúvidas, consulte os arquivos de documentação ou entre em contato com o suporte técnico.
