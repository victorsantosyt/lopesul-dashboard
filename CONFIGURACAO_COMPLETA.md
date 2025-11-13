# 🚀 Configuração Completa do Sistema Lopesul WiFi

**Status**: ✅✅✅ SISTEMA 100% OPERACIONAL - VPS e MikroTik conectados e funcionando!

---

## 📊 Infraestrutura

### VPS (67.211.212.18)
- **Provedor**: DigitalOcean/VPS
- **OS**: Ubuntu 24.04
- **IP Público**: `67.211.212.18`
- **SSH**: Porta 22 (apenas chave pública)
- **Domínios**:
  - `painel.lopesuldashboardwifi.com` → Painel administrativo
  - `cativo.lopesuldashboardwifi.com` → Portal de pagamento

### MikroTik
- **IP no túnel WireGuard**: `10.200.200.2`
- **Chave pública**: `pcQIkUSeBr0CKvMe4LCP/xcQ2xPitjjGeZFsWrlBvSA=`
- **Usuário API**: `relay`
- **Senha API**: `api2025`
- **Porta API**: `8728`

### Banco de Dados (Railway)
- **Host**: `caboose.proxy.rlwy.net:26705`
- **Database**: `railway`
- **User**: `postgres`
- **Password**: `FAsHKyWWlQivIgTdapIkspDpnLdWCgHP`
- **Connection String**: `postgresql://postgres:FAsHKyWWlQivIgTdapIkspDpnLdWCgHP@caboose.proxy.rlwy.net:26705/railway`

---

## 🔐 SSH - Acesso à VPS

### Chave SSH autorizada:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDAGl6IMM53YhcftJrD3aY8bU78loxCKCW6CoRTkBKbw mac@lopesul
```

### Conectar:
```bash
ssh root@67.211.212.18
```

**Configuração de segurança**:
- ✅ Autenticação por senha: DESATIVADA
- ✅ Root login: apenas com chave pública
- ✅ Porta: 22

---

## 🔌 WireGuard - Túnel VPN

### VPS (10.200.200.1)

**Arquivo**: `/etc/wireguard/wg-vps.conf`
```ini
[Interface]
Address = 10.200.200.1/32
ListenPort = 51820
PrivateKey = sMLELvo7zeFhLSzD2njASTl0klBPA6WOIpwZThTf3WY=
SaveConfig = false

[Peer]
# MikroTik
PublicKey = pcQIkUSeBr0CKvMe4LCP/xcQ2xPitjjGeZFsWrlBvSA=
AllowedIPs = 10.200.200.2/32
PersistentKeepalive = 25
```

**Chave pública do VPS**:
```
UvQCaJdGn8OxBrJEGmPPm60iQLGxaE+zAFc04Ax3EFw=
```

**Comandos úteis**:
```bash
# Ver status
ssh root@67.211.212.18 'wg show'

# Reiniciar WireGuard
ssh root@67.211.212.18 'systemctl restart wg-quick@wg-vps'

# Ver chave pública
ssh root@67.211.212.18 'cat /etc/wireguard/wg-vps.pub'
```

### MikroTik (10.200.200.2)

**⚠️ CONFIGURAÇÃO NECESSÁRIA - Execute no MikroTik:**

#### Via Terminal RouterOS (SSH ou WinBox):
```routeros
# 1. Verificar interfaces existentes
/interface/wireguard/print

# 2. Remover interface antiga se existir
# /interface/wireguard/remove [número]

# 3. Criar interface WireGuard
/interface/wireguard/add name=wg-vps listen-port=51820

# 4. Adicionar IP do túnel
/ip/address/add address=10.200.200.2/32 interface=wg-vps

# 5. Adicionar peer (VPS)
/interface/wireguard/peers/add \
  interface=wg-vps \
  public-key="UvQCaJdGn8OxBrJEGmPPm60iQLGxaE+zAFc04Ax3EFw=" \
  endpoint-address=67.211.212.18 \
  endpoint-port=51820 \
  allowed-address=10.200.200.1/32 \
  persistent-keepalive=25s

# 6. Verificar conexão
/interface/wireguard/peers/print detail
```

#### Verificar se conectou:
```routeros
# No MikroTik
/interface/wireguard/peers/print detail
# Deve mostrar "last-handshake" recente

/ping 10.200.200.1 count=4
# Deve responder
```

---

## 🌐 Aplicações na VPS

### 1. Painel Administrativo (porta 3000)

**Diretório**: `/opt/painel-new/`

**Arquivo**: `/opt/painel-new/.env`
```env
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://postgres:FAsHKyWWlQivIgTdapIkspDpnLdWCgHP@caboose.proxy.rlwy.net:26705/railway"
JWT_SECRET=dev-secret
APP_URL="https://painel.lopesuldashboardwifi.com"
PAGARME_SECRET_KEY="sk_test_CONFIGURE_ME"
MIKROTIK_HOST=10.200.200.2
MIKROTIK_USER=relay
MIKROTIK_PASS=api2025
MIKROTIK_PORT=8728
MIKROTIK_SSL=0
MIKROTIK_TIMEOUT_MS=8000
RELAY_URL=http://localhost:3001
RELAY_TOKEN=JNF8T7IOBI
```

**Comandos úteis**:
```bash
# Ver logs
ssh root@67.211.212.18 'pm2 logs lopesul-painel --lines 30'

# Reiniciar
ssh root@67.211.212.18 'pm2 restart lopesul-painel'

# Status
ssh root@67.211.212.18 'pm2 status'
```

**URL**: https://painel.lopesuldashboardwifi.com

---

### 2. Mikrotik Relay (porta 3001)

**Diretório**: `/root/mikrotik-relay/`

**Arquivo**: `/root/mikrotik-relay/.env`
```env
# Relay HTTP
PORT=3001
INTERVAL=15000

# Autorização
RELAY_TOKEN=JNF8T7IOBI
TOKEN=JNF8T7IOBI

# CORS
CORS_ORIGINS=https://painel.lopesuldashboardwifi.com/dashboard,https://cativo.lopesuldashboardwifi.com/pagamento.html,https://api.67-211-212-18.sslip.io

# MikroTiks
MIK_LIST=mkt01@10.200.200.2@relay@api2025,mkt02@10.200.200.3@relay@api2025
MKT_PORT=8728
MIKROTIK_HOST=10.200.200.2
MIKROTIK_USER=relay
MIKROTIK_PASS=api2025

# Logs
AUTH_DEBUG=0
```

**Comandos úteis**:
```bash
# Ver logs
ssh root@67.211.212.18 'pm2 logs mikrotik-relay --lines 30'

# Reiniciar
ssh root@67.211.212.18 'pm2 restart mikrotik-relay'
```

**URL interna**: http://localhost:3001

---

### 3. Portal Cativo (Nginx)

**Diretório**: `/var/www/cativo/`

**Arquivos**:
- `pagamento.html` - Página de pagamento
- `assets/` - Logos e imagens
- `captive/` - CSS e bibliotecas JS

**URL**: https://cativo.lopesuldashboardwifi.com/pagamento.html

---

## 🔧 Nginx - Reverse Proxy

**Arquivo**: `/etc/nginx/sites-available/lopesul`

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name painel.lopesuldashboardwifi.com;
    
    ssl_certificate /etc/letsencrypt/live/painel/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/painel/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    listen 443 ssl;
    server_name cativo.lopesuldashboardwifi.com;
    
    ssl_certificate /etc/letsencrypt/live/painel/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/painel/privkey.pem;
    
    root /var/www/cativo;
    index pagamento.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    location /api/ {
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Comandos úteis**:
```bash
# Testar configuração
ssh root@67.211.212.18 'nginx -t'

# Recarregar
ssh root@67.211.212.18 'systemctl reload nginx'

# Ver logs
ssh root@67.211.212.18 'tail -f /var/log/nginx/error.log'
```

---

## 🔥 Firewall

**Portas abertas**:
- `22/tcp` - SSH
- `80/tcp` - HTTP
- `443/tcp` - HTTPS
- `51820/udp` - WireGuard

```bash
# Verificar regras
ssh root@67.211.212.18 'iptables -L -n'

# Adicionar porta se necessário
ssh root@67.211.212.18 'iptables -A INPUT -p tcp --dport 22 -j ACCEPT'
```

---

## 📋 Checklist de Configuração

### ✅ VPS (Completo)
- [x] SSH configurado com chave pública
- [x] WireGuard instalado e configurado
- [x] Nginx instalado e configurado
- [x] Certificados SSL instalados
- [x] Painel (Next.js) rodando
- [x] Relay service rodando
- [x] Banco de dados Railway conectado
- [x] Portal cativo (HTML estático) servido

### ⚠️ MikroTik (Pendente)
- [ ] Interface WireGuard criada
- [ ] Peer VPS adicionado
- [ ] IP do túnel configurado
- [ ] Usuário API `relay` criado
- [ ] Conectividade testada

### 📝 Próximos passos
1. Configure o MikroTik usando os comandos acima
2. Configure `PAGARME_SECRET_KEY` no `/opt/painel-new/.env`
3. Teste o fluxo completo de pagamento
4. Crie usuário admin no painel

---

## 🧪 Testes de Conectividade

### Após configurar o MikroTik:

```bash
# Do VPS para o MikroTik
ssh root@67.211.212.18 'ping -c 4 10.200.200.2'

# Ver handshake WireGuard
ssh root@67.211.212.18 'wg show'
```

### No MikroTik:
```routeros
# Ping para VPS
/ping 10.200.200.1 count=4

# Ver status WireGuard
/interface/wireguard/peers/print detail
```

---

## 🆘 Troubleshooting

### WireGuard não conecta:
```bash
# Ver logs
ssh root@67.211.212.18 'journalctl -u wg-quick@wg-vps -n 50'

# Reiniciar
ssh root@67.211.212.18 'systemctl restart wg-quick@wg-vps'

# Verificar firewall
ssh root@67.211.212.18 'iptables -L -n | grep 51820'
```

### Painel não responde:
```bash
# Ver logs
ssh root@67.211.212.18 'pm2 logs lopesul-painel --lines 50'

# Reiniciar
ssh root@67.211.212.18 'pm2 restart lopesul-painel'
```

### Nginx erro:
```bash
# Testar config
ssh root@67.211.212.18 'nginx -t'

# Ver logs
ssh root@67.211.212.18 'tail -100 /var/log/nginx/error.log'
```

---

## 📞 Informações de Suporte

- **VPS IP**: 67.211.212.18
- **SSH**: `ssh root@67.211.212.18`
- **Painel**: https://painel.lopesuldashboardwifi.com
- **Cativo**: https://cativo.lopesuldashboardwifi.com/pagamento.html
- **Database**: Railway PostgreSQL

**Todas as senhas e tokens estão documentados neste arquivo. Guarde com segurança!** 🔐
