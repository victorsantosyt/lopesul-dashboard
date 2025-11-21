# 📚 Guia Completo de Scripts

Este documento lista todos os principais scripts criados para gerenciar o sistema Lopesul Dashboard.

---

## 🔓 **LIBERAR ACESSO DE CLIENTES**

### 1. `liberar-cliente-pago.js`
**Descrição:** Libera acesso para cliente que já pagou mas não tem sessão ativa.

**Uso:**
```bash
node liberar-cliente-pago.js <pedidoCode>
```

**Exemplo:**
```bash
node liberar-cliente-pago.js J0K9SDS80O
```

**O que faz:**
- Busca o pedido pelo código
- Verifica se está pago
- Chama a API de liberação
- Cria sessão ativa no banco
- Libera acesso no Mikrotik

---

### 2. `liberar-cliente-cortesia.js`
**Descrição:** Libera acesso de cortesia (cria pedido temporário de R$ 0,00).

**Uso:**
```bash
node liberar-cliente-cortesia.js <IP> <MAC> [deviceId] [mikId]
```

**Exemplo:**
```bash
# Apenas IP e MAC (tenta detectar dispositivo automaticamente)
node liberar-cliente-cortesia.js 192.168.88.65 1A:A0:2A:08:C7:12

# Com deviceId e mikId explícitos
node liberar-cliente-cortesia.js 192.168.88.65 1A:A0:2A:08:C7:12 cmi3x1jtv000xl3s1u9svk22n LOPESUL-HOTSPOT-06
```

**O que faz:**
- Cria pedido temporário de cortesia (R$ 0,00)
- Tenta detectar dispositivo automaticamente pelo IP
- Chama API de liberação
- Cria sessão ativa

---

### 3. `liberar-cliente-rapido.sh`
**Descrição:** Script shell para liberar acesso rapidamente via API.

**Uso:**
```bash
./liberar-cliente-rapido.sh <IP> <MAC> <pedidoCode>
```

**Exemplo:**
```bash
./liberar-cliente-rapido.sh 192.168.88.68 24:29:34:91:1A:18 KPN2TGTO8Z
```

---

### 4. `cortesia-rapido.sh`
**Descrição:** Script shell para liberar cortesia rapidamente.

**Uso:**
```bash
./cortesia-rapido.sh <IP> <MAC> [mikId]
```

**Exemplo:**
```bash
./cortesia-rapido.sh 192.168.88.80 8A:22:3C:F4:F9:70 LOPESUL-HOTSPOT-06
```

---

## 🔍 **VERIFICAR STATUS DE CLIENTES**

### 5. `verificar-cliente-pagarme.js`
**Descrição:** Verifica status completo de um cliente baseado no código do pedido do Pagar.me.

**Uso:**
```bash
# Edite o arquivo e altere PEDIDO_CODE e CHARGE_ID no início
node verificar-cliente-pagarme.js
```

**Ou use via script shell:**
```bash
./verificar-cliente-rapido.sh <pedidoCode>
```

**O que mostra:**
- Status do pedido (PAID, PENDING, EXPIRED)
- Informações da charge do Pagar.me
- Dispositivo associado
- Sessões ativas
- Resumo completo

---

### 6. `verificar-cliente-rapido.sh`
**Descrição:** Script shell para verificar cliente rapidamente via API.

**Uso:**
```bash
./verificar-cliente-rapido.sh <pedidoCode>
```

**Exemplo:**
```bash
./verificar-cliente-rapido.sh J0K9SDS80O
```

---

### 7. `verificar-pedidos-cliente.js`
**Descrição:** Lista todos os pedidos de um cliente (por IP ou MAC).

**Uso:**
```bash
# Edite o arquivo e altere IP e MAC no início
node verificar-pedidos-cliente.js
```

---

## 🧹 **LIMPEZA E MANUTENÇÃO**

### 8. `limpar-sessoes-expiradas.js`
**Descrição:** Remove sessões expiradas do banco de dados.

**Uso:**
```bash
node limpar-sessoes-expiradas.js
```

**O que faz:**
- Busca todas as sessões com `expiraEm < agora` e `ativo = true`
- Marca como `ativo = false`
- Mostra quantas foram limpas

---

### 9. `zerar-receita-dashboard.js`
**Descrição:** Zera a receita do dashboard (marca pedidos antigos como EXPIRED).

**Uso:**
```bash
# CUIDADO: Isso marca pedidos antigos como expirados!
node zerar-receita-dashboard.js
```

**O que faz:**
- Marca pedidos antigos como `EXPIRED`
- Permite resetar a receita do dashboard
- Mantém os dados históricos no banco

---

### 10. `remover-pedido-especifico.js`
**Descrição:** Remove um pedido específico do banco.

**Uso:**
```bash
# Edite o arquivo e altere PEDIDO_CODE no início
node remover-pedido-especifico.js
```

---

## 💾 **BACKUP**

### 11. `fazer-backup-banco.sh`
**Descrição:** Faz backup completo do banco de dados PostgreSQL.

**Uso:**
```bash
./fazer-backup-banco.sh
```

**O que faz:**
- Faz dump do banco PostgreSQL (Railway)
- Salva em `/backup/backup-YYYYMMDD-HHMM.sql`
- Remove backups antigos (mais de 7 dias)

---

### 12. `backup-simples.sh`
**Descrição:** Backup simplificado do banco.

**Uso:**
```bash
./backup-simples.sh
```

---

## 🔧 **CRIAR/MODIFICAR DADOS**

### 13. `criar-sessao-ativa-manual.js`
**Descrição:** Cria ou atualiza uma sessão ativa manualmente no banco.

**Uso:**
```bash
# Edite o arquivo e altere IP, MAC, pedidoId no início
node criar-sessao-ativa-manual.js
```

**O que faz:**
- Cria/atualiza `SessaoAtiva` no banco
- Útil para correções rápidas sem deploy

---

### 14. `atualizar-mikid-hotspot-06.js`
**Descrição:** Atualiza o `mikId` de um dispositivo específico.

**Uso:**
```bash
# Edite o arquivo e altere os valores no início
node atualizar-mikid-hotspot-06.js
```

---

## 📊 **VERIFICAR DISPOSITIVOS**

### 15. `verificar-dispositivos-standalone.js`
**Descrição:** Lista todos os dispositivos cadastrados no banco.

**Uso:**
```bash
node verificar-dispositivos-standalone.js
```

**O que mostra:**
- Lista todos os dispositivos
- Mostra ID, mikId, IP, Host, User, Frota

---

## 📝 **LOGS E MONITORAMENTO**

### 16. `ver-logs-mikrotik.sh`
**Descrição:** Filtra e mostra logs relacionados ao Mikrotik.

**Uso:**
```bash
./ver-logs-mikrotik.sh [linhas]
```

**Exemplo:**
```bash
./ver-logs-mikrotik.sh 100
```

---

## 🚀 **DEPLOY**

### 17. `deploy-seguro-com-backup.sh`
**Descrição:** Faz deploy seguro com backup automático.

**Uso:**
```bash
./deploy-seguro-com-backup.sh
```

**O que faz:**
- Faz backup do banco antes do deploy
- Faz `git pull`
- Executa `npm run build`
- Reinicia PM2
- Mostra logs

---

## 📋 **RESUMO RÁPIDO**

### Scripts mais usados:

1. **Liberar acesso de cliente que pagou:**
   ```bash
   node liberar-cliente-pago.js <pedidoCode>
   ```

2. **Liberar cortesia:**
   ```bash
   node liberar-cliente-cortesia.js <IP> <MAC> [mikId]
   ```

3. **Verificar cliente:**
   ```bash
   ./verificar-cliente-rapido.sh <pedidoCode>
   ```

4. **Fazer backup:**
   ```bash
   ./fazer-backup-banco.sh
   ```

5. **Limpar sessões expiradas:**
   ```bash
   node limpar-sessoes-expiradas.js
   ```

---

## ⚠️ **IMPORTANTE**

- Todos os scripts Node.js precisam ser executados de dentro do diretório do projeto (`/opt/lopesul-dashboard` no servidor)
- Scripts shell podem ser executados de qualquer lugar (mas precisam estar no servidor)
- Sempre faça backup antes de executar scripts que modificam dados
- Para scripts que precisam editar valores, abra o arquivo e altere as constantes no início

---

## 🔗 **SCRIPTS NO SERVIDOR**

Para usar os scripts no servidor:

```bash
# Conectar ao servidor
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18

# Ir para o diretório do projeto
cd /opt/lopesul-dashboard

# Executar script
node liberar-cliente-pago.js J0K9SDS80O
```

Ou execute remotamente:
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'cd /opt/lopesul-dashboard && node liberar-cliente-pago.js J0K9SDS80O'
```

