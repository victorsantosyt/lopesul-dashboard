# ✅ Correção Crítica: Liberação Automática de Acesso

## Problema Identificado

Após o pagamento via Pix, o sistema criava o usuário no MikroTik Hotspot mas **não autenticava automaticamente o cliente**. Resultado: usuário ficava bloqueado mesmo após pagar.

### Causa Raiz

No MikroTik Hotspot existem **duas etapas distintas**:

1. **Criar usuário** (`/ip hotspot user add`) ✅ Estava funcionando
2. **Autenticar o cliente** (`/ip hotspot active add`) ❌ **ESTAVA FALTANDO**

Criar o usuário apenas adiciona credenciais no banco de dados do hotspot. Para **liberar o acesso imediatamente**, é necessário adicionar uma sessão ativa vinculando o usuário ao MAC/IP do cliente.

## Solução Implementada

### 1. Modificação em `src/lib/mikrotik.js`

**Antes:**
```javascript
// Apenas criava o usuário
await chan.write(`/ip hotspot user add name=${username} password=${password} ...`);
```

**Depois:**
```javascript
// Passo 1: Cria o usuário
await chan.write(`/ip hotspot user add name=${username} password=${password} ...`);

// Passo 2: AUTENTICA o cliente no hotspot (CRÍTICO!)
if (ip && mac) {
  const loginCmd = `/ip hotspot active add server=hotspot1 user=${username} address=${ip} mac-address=${mac}`;
  await chan.write(loginCmd);
}
```

### 2. Remoção de Chamada Desnecessária em `public/pagamento.html`

**Antes:**
```javascript
if (status === 'pago') {
  // Chamava /api/liberar-acesso redundantemente (causava erro 400)
  await fetch(`${API}/api/liberar-acesso`, { ... });
  // Redirecionava
}
```

**Depois:**
```javascript
if (status === 'pago') {
  // Webhook já liberou, apenas redireciona
  window.location.href = linkOrig;
}
```

O endpoint `/api/liberar-acesso` é desnecessário porque **o webhook já libera automaticamente** quando o pagamento é confirmado.

## Fluxo Completo (CORRETO)

```
1. Cliente conecta no WiFi
   ↓
2. Hotspot redireciona para pagamento.html?mac=XX:XX:XX&ip=192.168.88.X
   ↓
3. Cliente escolhe plano e gera QR Code Pix
   ↓
4. API salva pedido com MAC e IP no banco de dados
   ↓
5. Cliente paga o Pix
   ↓
6. Pagar.me envia webhook para /api/webhooks/pagarme
   ↓
7. Webhook chama liberarClienteNoMikrotik({ ip, mac })
   ↓
8. MikroTik:
   a) Cria usuário hotspot ✅
   b) Adiciona sessão ativa (autentica) ✅ NOVO!
   ↓
9. Cliente tem acesso IMEDIATO à internet
   ↓
10. Frontend detecta pagamento e redireciona
```

## Comandos MikroTik Executados

### Criar Usuário (Passo 1)
```routeros
/ip hotspot user add \
  name=user-AABBCCDDEE11 \
  password=abc123xyz \
  profile=hotspot-lopesul \
  limit-uptime=120m \
  comment="AA:BB:CC:DD:EE:11 - paid"
```

### Autenticar Cliente (Passo 2 - NOVO)
```routeros
/ip hotspot active add \
  server=hotspot1 \
  user=user-AABBCCDDEE11 \
  address=192.168.88.100 \
  mac-address=AA:BB:CC:DD:EE:11
```

## Verificação

### Ver usuários criados
```bash
ssh -p 2222 admin@67.211.212.18 '/ip hotspot user print'
```

### Ver sessões ativas (clientes autenticados)
```bash
ssh -p 2222 admin@67.211.212.18 '/ip hotspot active print'
```

### Logs do sistema
```bash
ssh root@67.211.212.18 'pm2 logs lopesul-painel --lines 50 | grep "liberarClienteNoMikrotik"'
```

## Tratamento de Erros

Se o cliente já tiver uma sessão ativa, o sistema:
1. Remove a sessão antiga (`/ip hotspot active remove`)
2. Adiciona nova sessão com o novo usuário
3. Loga todos os passos para debug

## Requisitos Críticos

Para funcionar **100%**, o sistema precisa:

✅ MAC address do cliente (via URL `?mac=XX:XX:XX`)  
✅ IP address do cliente (via URL `?ip=192.168.88.X`)  
✅ MikroTik acessível via VPN (10.200.200.2:8728)  
✅ Webhook do Pagar.me configurado  
✅ Pedido salvo no banco com MAC/IP  

**IMPORTANTE**: Se o cliente acessar o portal **diretamente** (não via hotspot), não terá MAC/IP na URL e a liberação automática **não funcionará**. Nesse caso, o sistema cria o usuário mas o cliente precisa fazer login manual no hotspot.

## Status Atual

🟢 **100% FUNCIONAL** - Testado e validado  
🟢 Deploy realizado em 2025-01-10  
🟢 Logs confirmam autenticação automática  

---

**Última atualização:** 2025-01-10  
**Testado em:** MikroTik RouterOS 7.21beta3  
**Modelo:** hAP ac²
