# ✅ Hotspot MikroTik 100% Configurado

## Resumo da Configuração

O hotspot está **100% funcional** no MikroTik com as seguintes características:

### 🔧 Configuração Básica

- **Nome**: hotspot1
- **Interface**: bridge
- **Pool de IPs**: lan-pool (192.168.88.10-254)
- **Perfil**: hotspot-lopesul
- **DNS Name**: lopesul.wifi
- **Timeout de inatividade**: 5 minutos
- **Cookie lifetime**: 1 dia
- **Endereços por MAC**: 2

### 🌐 Página de Login Personalizada

Localização: `flash/hotspot/login.html`

A página customizada:
- ✅ Design moderno e responsivo
- ✅ Redirecionamento automático para portal de pagamento
- ✅ URL: https://cativo.lopesuldashboardwifi.com/pagamento.html
- ✅ Preserva link original (`link-orig`) para redirecionamento pós-autenticação
- ✅ Loader animado durante redirecionamento (2 segundos)
- ✅ Botão manual caso o redirect falhe

### 🔓 Walled Garden (Sites Permitidos Antes da Autenticação)

Os seguintes domínios estão liberados **antes** do login:

1. ✅ `cativo.lopesuldashboardwifi.com` - Portal captivo
2. ✅ `painel.lopesuldashboardwifi.com` - Dashboard/API
3. ✅ `*.pagar.me` - Gateway de pagamento
4. ✅ `api.pagar.me` - API do Pagar.me
5. ✅ `*.cloudflare.com` - CDN/Assets
6. ✅ `*.googleapis.com` - Recursos do Google

## 🚀 Como Funciona

### Fluxo do Cliente

1. **Cliente conecta no Wi-Fi** → MikroTik detecta que não está autenticado
2. **Qualquer tentativa HTTP** → Redireciona para `flash/hotspot/login.html`
3. **Login.html carrega** → Mostra tela de "Redirecionando..." com loader
4. **Após 2 segundos** → JavaScript redireciona automaticamente para:
   ```
   https://cativo.lopesuldashboardwifi.com/pagamento.html?link-orig=URL_ORIGINAL
   ```
5. **Cliente escolhe plano** → Paga via Pix ou Cartão no portal
6. **Pagamento confirmado** → Webhook do Pagar.me chama `/api/webhooks/pagarme`
7. **Backend libera acesso** → Função `liberarClienteNoMikrotik()` em `src/lib/mikrotik.ts`
8. **Cliente autenticado** → MikroTik permite navegação total

### Fluxo de Liberação de Acesso

O sistema usa a biblioteca RouterOS API (via relay service) para:

```javascript
// src/lib/mikrotik.ts
await liberarClienteNoMikrotik({
  mac: '00:11:22:33:44:55',
  ip: '192.168.88.100',
  duracao: 86400, // segundos (24h)
  plano: 'Premium 24h'
});
```

Isso cria um usuário hotspot temporário no MikroTik com:
- Username: `user-<MAC_ADDRESS>`
- Password: gerada automaticamente
- Profile: `hotspot-lopesul`
- Limite de tempo: configurável por plano

## 📋 Comandos Úteis

### Verificar hotspot ativo
```bash
ssh -p 2222 admin@67.211.212.18 '/ip hotspot print'
```

### Ver usuários conectados
```bash
ssh -p 2222 admin@67.211.212.18 '/ip hotspot active print'
```

### Ver usuários cadastrados
```bash
ssh -p 2222 admin@67.211.212.18 '/ip hotspot user print'
```

### Desconectar um usuário específico
```bash
ssh -p 2222 admin@67.211.212.18 '/ip hotspot active remove [find mac-address=XX:XX:XX:XX:XX:XX]'
```

### Verificar walled garden
```bash
ssh -p 2222 admin@67.211.212.18 '/ip hotspot walled-garden print'
```

### Adicionar novo domínio ao walled garden
```bash
ssh -p 2222 admin@67.211.212.18 '/ip hotspot walled-garden add dst-host=exemplo.com.br action=allow comment="Descrição"'
```

## 🧪 Teste do Hotspot

### 1. Teste de Conectividade
```bash
# Da VPS, verifique se consegue acessar o MikroTik
nc -zv -w2 10.200.200.2 8728  # Porta API
```

### 2. Teste do Portal Captivo
1. Conecte um dispositivo no Wi-Fi
2. Abra o navegador e tente acessar qualquer site HTTP (ex: http://neverssl.com)
3. Deve redirecionar para a página customizada
4. Após 2 segundos, deve ir para https://cativo.lopesuldashboardwifi.com/pagamento.html

### 3. Teste de Pagamento
1. No portal, escolha um plano
2. Pague via Pix (recomendado para teste)
3. Aguarde confirmação do webhook (10-30 segundos)
4. Deve liberar acesso automaticamente

## 🔒 Segurança

### Firewall Rules Aplicadas

```routeros
# Aceita tráfego do túnel WireGuard
/ip firewall filter add chain=input in-interface=wg-vps action=accept comment="VPS via WireGuard"

# Aceita conexões estabelecidas
/ip firewall filter add chain=input connection-state=established,related action=accept

# NAT para hotspot
/ip firewall nat add chain=srcnat out-interface=wg-vps action=masquerade
```

### Variáveis de Ambiente Necessárias

No arquivo `/opt/painel-new/.env` na VPS:

```bash
# MikroTik
MIKROTIK_HOST=10.200.200.2
MIKROTIK_PORT=8728
MIKROTIK_USER=relay
MIKROTIK_PASS=api2025
MIKROTIK_SSL=0
MIKROTIK_TIMEOUT_MS=5000

# Relay Service
RELAY_URL=http://localhost:3001
RELAY_TOKEN=JNF8T7IOBI

# Pagar.me
PAGARME_SECRET_KEY=sk_3d3bce2771e84ac1a16641ab9184f2dc

# Database
DATABASE_URL=postgresql://postgres:FAsHKyWWlQivIgTdapIkspDpnLdWCgHP@caboose.proxy.rlwy.net:26705/railway
```

## 📊 Monitoramento

### Logs do Sistema

```bash
# Logs do painel (Next.js)
ssh root@67.211.212.18 'pm2 logs lopesul-painel --lines 50'

# Logs do relay
ssh root@67.211.212.18 'pm2 logs mikrotik-relay --lines 50'

# Logs do Nginx
ssh root@67.211.212.18 'tail -f /var/log/nginx/access.log'
ssh root@67.211.212.18 'tail -f /var/log/nginx/error.log'
```

### Endpoints de Status

- **API Geral**: https://painel.lopesuldashboardwifi.com/api/dashboard
- **Status MikroTik**: https://painel.lopesuldashboardwifi.com/api/mikrotik/status
- **Status Dispositivos**: https://painel.lopesuldashboardwifi.com/api/dispositivos/status
- **Health Check**: https://painel.lopesuldashboardwifi.com/api/db-health

## ✅ Checklist de Funcionamento

- [x] Hotspot criado e ativo no MikroTik
- [x] Perfil `hotspot-lopesul` configurado
- [x] Página de login personalizada (`login.html`)
- [x] Walled garden com todos os domínios necessários
- [x] Redirecionamento automático para portal de pagamento
- [x] Integração com Pagar.me (Pix + Cartão)
- [x] Webhook configurado e funcional
- [x] Liberação automática de acesso após pagamento
- [x] Túnel WireGuard VPS ↔ MikroTik funcionando
- [x] Relay service operacional
- [x] Dashboard mostrando status corretamente
- [x] SSL/HTTPS configurado (Let's Encrypt)

## 🎉 Sistema 100% Operacional!

O hotspot está completamente configurado e pronto para uso em produção. Todos os componentes estão integrados e funcionando corretamente.

---

**Data da Configuração**: 2025-11-10  
**Versão do RouterOS**: 7.21beta3  
**Modelo do MikroTik**: hAP ac²
