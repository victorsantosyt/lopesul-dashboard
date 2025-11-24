# Comandos para Monitorar Teste Real

## 1. Monitorar logs do dashboard em tempo real (filtrado)
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs 4 --lines 0 --raw' | grep -E "(Portal|detect-client|checkout|webhook|MIKROTIK|deviceIdentifier|deviceId|mikId|QR|Erro|ERROR)"
```

## 2. Monitorar logs do relay em tempo real
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs mikrotik-relay --lines 0 --raw'
```

## 3. Ver últimas 50 linhas de logs do dashboard (filtrado)
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs 4 --lines 50 --nostream' | grep -E "(Portal|detect-client|checkout|webhook|MIKROTIK|deviceIdentifier|deviceId|mikId|QR|Erro|ERROR)"
```

## 4. Ver logs específicos do detect-client
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs 4 --lines 100 --nostream' | grep -E "detect-client"
```

## 5. Ver logs específicos do checkout
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs 4 --lines 100 --nostream' | grep -E "checkout|pagamentos"
```

## 6. Ver logs do webhook (quando o pagamento for confirmado)
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs 4 --lines 100 --nostream' | grep -E "webhook|pagarme"
```

## 7. Ver logs do Mikrotik (liberação de acesso)
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs 4 --lines 100 --nostream' | grep -E "\[MIKROTIK\]|liberarAcesso|modo inteligente"
```

## 8. Verificar pedidos recentes no banco
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'cd /opt/lopesul-dashboard && node -e "
import prisma from \"./src/lib/prisma.js\";
const pedidos = await prisma.pedido.findMany({
  where: { createdAt: { gte: new Date(Date.now() - 3600000) } },
  orderBy: { createdAt: \"desc\" },
  take: 5,
  select: { id: true, code: true, status: true, deviceId: true, ip: true, mac: true, createdAt: true }
});
console.log(JSON.stringify(pedidos, null, 2));
process.exit(0);
"'
```

## 9. Verificar sessões ativas recentes
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'cd /opt/lopesul-dashboard && node -e "
import prisma from \"./src/lib/prisma.js\";
const sessoes = await prisma.sessaoAtiva.findMany({
  where: { createdAt: { gte: new Date(Date.now() - 3600000) } },
  orderBy: { createdAt: \"desc\" },
  take: 5
});
console.log(JSON.stringify(sessoes, null, 2));
process.exit(0);
"'
```

## 10. Monitorar tudo em uma única janela (recomendado)
```bash
# Abra 3 terminais e execute cada um:

# Terminal 1: Logs do dashboard
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs 4 --lines 0 --raw'

# Terminal 2: Logs do relay
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs mikrotik-relay --lines 0 --raw'

# Terminal 3: Verificar pedidos/sessões periodicamente
watch -n 5 'ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 "cd /opt/lopesul-dashboard && node -e \"import prisma from \\\"./src/lib/prisma.js\\\"; prisma.pedido.findMany({where: {createdAt: {gte: new Date(Date.now() - 600000)}}, orderBy: {createdAt: \\\"desc\\\"}, take: 3}).then(p => console.log(JSON.stringify(p, null, 2))).then(() => process.exit(0));\""'
```

## Sequência de Teste Recomendada:

1. **Antes de conectar no Wi-Fi:**
   - Execute o comando #1 ou #3 para ver os logs

2. **Ao conectar no Wi-Fi e abrir o portal:**
   - Você deve ver logs do `detect-client` com o IP detectado
   - Verifique se `deviceId` ou `mikId` foi encontrado

3. **Ao clicar em "Gerar QR Code":**
   - Você deve ver logs do `checkout` com o `deviceId`/`mikId`
   - Verifique se o QR code foi gerado

4. **Após pagar o QR code:**
   - Você deve ver logs do `webhook` com o pagamento confirmado
   - Você deve ver logs do `[MIKROTIK]` com a liberação de acesso
   - Verifique se uma `SessaoAtiva` foi criada

