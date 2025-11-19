# Guia de Configuração - Múltiplos Mikrotiks

Este guia ajuda a configurar todos os Mikrotiks para funcionarem de forma independente.

## 📋 Pré-requisitos

1. Cada Mikrotik deve ter um `identity` único (ex: `LOPESUL-HOTSPOT-01`, `LOPESUL-HOTSPOT-02`, etc.)
2. Cada Mikrotik deve estar acessível via SSH (usuário `relay`, senha `api2025`)
3. Cada Mikrotik deve ter um IP único na rede (ex: `10.200.200.2`, `10.200.200.3`, etc.)

## 🔧 Passo 1: Verificar o identity de cada Mikrotik

Execute em cada Mikrotik (via SSH ou Winbox):

```bash
/system identity print
```

Anote o `name` de cada um. Exemplo:
- Mikrotik 1: `LOPESUL-HOTSPOT-01`
- Mikrotik 2: `LOPESUL-HOTSPOT-02`
- Mikrotik 3: `LOPESUL-HOTSPOT-03`
- etc.

**Se o identity não corresponder ao padrão esperado, configure:**

```bash
/system identity set name="LOPESUL-HOTSPOT-01"  # Ajuste o número
```

## 🔧 Passo 2: Configurar dispositivos no banco de dados

1. **No servidor**, execute o script de verificação:

```bash
cd /opt/lopesul-dashboard
node verificar-dispositivos-standalone.js
```

2. **Edite o script** `configurar-todos-dispositivos.js` e ajuste o `MAPEAMENTO_MIKROTIKS`:

```javascript
const MAPEAMENTO_MIKROTIKS = {
  '10.200.200.2': 'LOPESUL-HOTSPOT-01',  // ⚠️ Use o identity real do Mikrotik
  '10.200.200.3': 'LOPESUL-HOTSPOT-02',
  '10.200.200.4': 'LOPESUL-HOTSPOT-03',
  '10.200.200.5': 'LOPESUL-HOTSPOT-04',
  '10.200.200.6': 'LOPESUL-HOTSPOT-05',
  '10.200.200.7': 'LOPESUL-HOTSPOT-06',
};
```

3. **Execute o script** para criar/atualizar os dispositivos:

```bash
node configurar-todos-dispositivos.js
```

## 🔧 Passo 3: Configurar redirect.html em cada Mikrotik

Para cada Mikrotik, configure o `redirect.html`:

1. **Via SSH** (recomendado):

```bash
ssh relay@10.200.200.2  # Ajuste o IP
```

2. **Criar/atualizar o redirect.html**:

```bash
/file print
/file set redirect.html contents="<meta http-equiv=\"refresh\" content=\"0; url=https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=\$(mac)&ip=\$(ip)&mikId=LOPESUL-HOTSPOT-01&deviceId=LOPESUL-HOTSPOT-01\$(if link-orig)&link-orig=\$(link-orig)\$(endif)\">"
```

⚠️ **IMPORTANTE**: Substitua `LOPESUL-HOTSPOT-01` pelo identity correto de cada Mikrotik!

3. **Configurar o hotspot profile**:

```bash
/ip hotspot profile set [find name="default"] html-directory="/redirect.html"
```

## 🔧 Passo 4: Configurar Walled Garden

Certifique-se de que cada Mikrotik tem as regras de Walled Garden:

```bash
/ip hotspot/walled-garden/print
/ip hotspot/walled-garden/add dst-host="cativo.lopesuldashboardwifi.com"
/ip hotspot/walled-garden/add dst-host="*.lopesuldashboardwifi.com"
/ip hotspot/walled-garden/add dst-host="api.pagar.me"
/ip hotspot/walled-garden/add dst-host="*.pagar.me"
```

## ✅ Verificação

Para cada Mikrotik, verifique:

1. **Identity está correto:**
   ```bash
   /system identity print
   ```

2. **redirect.html existe e está correto:**
   ```bash
   /file print where name~redirect
   ```

3. **Hotspot profile está usando redirect.html:**
   ```bash
   /ip hotspot profile print
   ```

4. **Walled Garden está configurado:**
   ```bash
   /ip hotspot/walled-garden/print
   ```

5. **Dispositivo existe no banco:**
   ```bash
   cd /opt/lopesul-dashboard
   node verificar-dispositivos-standalone.js
   ```

## 🚀 Teste

1. Conecte um celular no Wi-Fi de um ônibus
2. Abra o navegador
3. Deve redirecionar para o portal de pagamento
4. Verifique nos logs do servidor se o `deviceId`/`mikId` foi detectado corretamente
5. Gere um QR code e teste o pagamento

## 📝 Checklist por Mikrotik

- [ ] Identity configurado corretamente
- [ ] redirect.html criado/atualizado com o mikId correto
- [ ] Hotspot profile configurado para usar redirect.html
- [ ] Walled Garden configurado
- [ ] Dispositivo criado/atualizado no banco de dados com o mikId correto
- [ ] Credenciais do Mikrotik (host, user, pass) configuradas no banco
- [ ] Teste de conexão e pagamento funcionando

## 🔄 Scripts Automatizados

Use os scripts fornecidos para automatizar:

- `verificar-identity-mikrotiks.sh` - Verifica o identity de todos os Mikrotiks
- `configurar-todos-dispositivos.js` - Configura todos os dispositivos no banco
- `configurar-redirect-todos-mikrotiks.sh` - Configura redirect.html em todos os Mikrotiks

