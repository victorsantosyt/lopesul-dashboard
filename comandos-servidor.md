# Comandos para executar no servidor

## 1. Verificar pedidos recentes (última hora)

```bash
cd /opt/lopesul-dashboard
export DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DATABASE_URL" -c "SELECT code, id, status, \"deviceId\", ip, mac, \"createdAt\" FROM \"Pedido\" WHERE \"createdAt\" > NOW() - INTERVAL '1 hour' ORDER BY \"createdAt\" DESC LIMIT 5;"
```

**OU usar o script Node.js:**
```bash
cd /opt/lopesul-dashboard
node check-recent-pedidos.js
```

## 2. Verificar pedidos PAID ou PENDING

```bash
cd /opt/lopesul-dashboard
export DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DATABASE_URL" -c "SELECT code, id, status, \"deviceId\", ip, mac, \"createdAt\" FROM \"Pedido\" WHERE status IN ('PAID', 'PENDING') ORDER BY \"createdAt\" DESC LIMIT 5;"
```

## 3. Verificar status do relay inteligente

```bash
pm2 logs mikrotik-relay --lines 30 --nostream | grep -E "(Prisma|Modo inteligente|relay.*http|exec-by-pedido|exec-by-device)"
```

## 4. Verificar logs do webhook (últimas chamadas)

```bash
pm2 logs 4 --lines 100 --nostream | grep -E "(webhook|markPaidAndRelease|liberarAcesso|MIKROTIK)" | tail -50
```

## 5. Verificar se o relay tem DATABASE_URL configurado

```bash
cd /opt/lopesul-infra/relay
grep DATABASE_URL .env
```

## 6. Verificar se Prisma Client está disponível no relay

```bash
ls -la /opt/lopesul-infra/relay/node_modules/@prisma/client/package.json
ls -la /opt/lopesul-infra/relay/node_modules/.prisma/client/index.js
```

## 7. Testar endpoint inteligente do relay (substitua PEDIDO_ID por um ID real)

```bash
curl -X POST http://localhost:4000/relay/exec-by-pedido \
  -H "Content-Type: application/json" \
  -H "X-Relay-Token: $(grep RELAY_TOKEN /opt/lopesul-infra/relay/.env | cut -d= -f2)" \
  -d '{"pedidoId": "PEDIDO_ID", "command": "/ip firewall address-list print"}'
```

## 8. Verificar última sessão ativa criada

```bash
cd /opt/lopesul-dashboard
export DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d= -f2- | tr -d '"' | tr -d "'")
psql "$DATABASE_URL" -c "SELECT id, \"ipCliente\", \"macCliente\", plano, \"inicioEm\", \"expiraEm\", \"pedidoId\", \"roteadorId\" FROM \"SessaoAtiva\" ORDER BY \"inicioEm\" DESC LIMIT 3;"
```

