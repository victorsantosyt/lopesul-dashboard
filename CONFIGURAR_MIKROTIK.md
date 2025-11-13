# Configuração do MikroTik para conectar ao VPS via WireGuard

**Chave pública do VPS:** `UvQCaJdGn8OxBrJEGmPPm60iQLGxaE+zAFc04Ax3EFw=` ✅ (CONFIRMADA)
**IP do VPS:** `67.211.212.18`  
**Porta WireGuard:** `51820`  
**IP do túnel VPS:** `10.200.200.1/32`

---

## 📋 O que fazer no MikroTik

### Opção 1: Via Terminal RouterOS (SSH ou WinBox Terminal)

Conecte no MikroTik via SSH ou abra o Terminal no WinBox e execute:

```routeros
# 1. Verificar se já existe interface wg-vps (se sim, remova)
/interface/wireguard/print
# Se existir wg-vps: /interface/wireguard/remove [encontre o número]

# 2. Criar nova interface WireGuard
/interface/wireguard/add name=wg-vps listen-port=51820

# 3. Adicionar endereço IP do túnel
/ip/address/add address=10.200.200.2/32 interface=wg-vps

# 4. Adicionar peer (VPS) com a chave pública
/interface/wireguard/peers/add \
  interface=wg-vps \
  public-key="UvQCaJdGn8OxBrJEGmPPm60iQLGxaE+zAFc04Ax3EFw=" \
  endpoint-address=67.211.212.18 \
  endpoint-port=51820 \
  allowed-address=10.200.200.1/32 \
  persistent-keepalive=25s

# 5. Verificar conexão
/interface/wireguard/print
/interface/wireguard/peers/print
```

### Opção 2: Via WinBox (Interface Gráfica)

1. **WireGuard → Interface**
   - Clique em `+` para adicionar
   - Name: `wg-vps`
   - Listen Port: `51820`
   - Clique em `OK`

2. **IP → Addresses**
   - Clique em `+` para adicionar
   - Address: `10.200.200.2/32`
   - Interface: `wg-vps`
   - Clique em `OK`

3. **WireGuard → Peers**
   - Clique em `+` para adicionar
   - Interface: `wg-vps`
   - Public Key: `UvQCaJdGn8OxBrJEGmPPm60iQLGxaE+zAFc04Ax3EFw=`
   - Endpoint: `67.211.212.18`
   - Endpoint Port: `51820`
   - Allowed Address: `10.200.200.1/32`
   - Persistent Keepalive: `00:00:25`
   - Clique em `OK`

---

## 🔍 Verificar se está funcionando

### No MikroTik:
```routeros
/interface/wireguard/peers/print detail
```
Deve mostrar "last-handshake" com timestamp recente.

### No VPS:
```bash
ssh root@67.211.212.18 'wg show'
```
Deve mostrar "latest handshake" com timestamp recente e dados transferidos.

### Testar conectividade:
```bash
# Do VPS para o MikroTik
ssh root@67.211.212.18 'ping -c 4 10.200.200.2'

# Do MikroTik para o VPS
/ping 10.200.200.1 count=4
```

---

## 📝 Informações importantes

- **Chave pública do MikroTik (já configurada no VPS):** `pcQIkUSeBr0CKvMe4LCP/xcQ2xPitjjGeZFsWrlBvSA=`
- **Rede do túnel:** `10.200.200.0/30`
  - VPS: `10.200.200.1`
  - MikroTik: `10.200.200.2`
- **Usuário relay no MikroTik:** `relay` / senha: `api2025`

---

## 🚀 Depois que o túnel estiver UP

O sistema já está configurado para:
1. Backend se comunicar com MikroTik via relay (`http://localhost:3001`)
2. Relay se comunicar com MikroTik via túnel WireGuard (`10.200.200.2:8728`)
3. Liberar clientes no MikroTik após pagamento confirmado

**Serviços rodando na VPS:**
- `mikrotik-relay` (porta 3001) - Proxy para comandos MikroTik
- Nginx (porta 80/443) - Reverse proxy para aplicações
- WireGuard (`wg-vps`) - Túnel seguro para MikroTik

Execute `ssh root@67.211.212.18 'pm2 status'` para ver o status dos serviços.
