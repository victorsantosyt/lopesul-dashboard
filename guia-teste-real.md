# 🔍 Guia de Acompanhamento - Teste Real de Pagamento

## 📋 Checklist de Verificação

### **ANTES DO PAGAMENTO**

1. **Verificar pedidos recentes:**
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'cd /opt/lopesul-dashboard && node -e "
import(\"@prisma/client\").then(({ PrismaClient }) => {
  const p = new PrismaClient();
  p.pedido.findMany({ orderBy: { createdAt: \"desc\" }, take: 3 })
    .then(pedidos => {
      console.log(\"\\n📦 Últimos 3 pedidos:\\n\");
      pedidos.forEach((ped, i) => {
        console.log(\`\${i+1}. Code: \${ped.code} | Status: \${ped.status}\`);
        console.log(\`   IP: \${ped.ip || \"N/A\"} | MAC: \${ped.deviceMac || \"N/A\"}\`);
      });
      p.\$disconnect();
    });
});"'
```

2. **Abrir logs em tempo real (em terminal separado):**
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs 4 --lines 0'
```

### **DURANTE O PAGAMENTO**

3. **Após gerar o QR code, anote o `code` do pedido** (ex: `ABC123XYZ`)

4. **Após pagar, monitore os logs:**
   - Deve aparecer: `[webhook] Event: charge.paid Order: [CODIGO]`
   - Deve aparecer: `[webhook] liberarAcesso executado com sucesso!`
   - Deve aparecer: `[webhook] Sessão ativa criada:`

### **APÓS O PAGAMENTO**

5. **Verificar pedido no banco:**
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'cd /opt/lopesul-dashboard && node -e "
import(\"@prisma/client\").then(({ PrismaClient }) => {
  const p = new PrismaClient();
  const code = \"[CODIGO_DO_PEDIDO]\"; // SUBSTITUA AQUI
  p.pedido.findFirst({ where: { code }, include: { SessaoAtiva: true } })
    .then(pedido => {
      if (!pedido) { console.log(\"❌ Pedido não encontrado\"); return; }
      console.log(\"\\n📦 Pedido:\", pedido.code);
      console.log(\"   Status:\", pedido.status);
      console.log(\"   Tem sessão:\", pedido.SessaoAtiva.length > 0 ? \"SIM\" : \"NÃO\");
      if (pedido.SessaoAtiva.length > 0) {
        pedido.SessaoAtiva.forEach(s => {
          console.log(\"   Sessão IP:\", s.ipCliente, \"| Roteador:\", s.roteadorId);
        });
      }
      p.\$disconnect();
    });
});"'
```

6. **Verificar se acesso foi liberado no Mikrotik:**
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'ssh relay@10.200.200.7 "/ip firewall address-list print where list=paid_clients"'
```

7. **Verificar se cliente tem acesso à internet:**
   - Teste no dispositivo do cliente
   - Ou verifique no Mikrotik:
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'ssh relay@10.200.200.7 "/ip hotspot active print"'
```

## 🚨 Pontos de Atenção

- ✅ **Webhook recebido?** → Ver logs do PM2
- ✅ **Acesso liberado?** → Ver logs `[MIKROTIK] Acesso liberado com sucesso`
- ✅ **Sessão criada?** → Verificar no banco
- ✅ **Cliente online?** → Verificar no Mikrotik

## 📊 Comandos Rápidos

**Ver logs do webhook (últimas 50 linhas):**
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs 4 --lines 50 --nostream | tail -50'
```

**Ver sessões ativas:**
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'cd /opt/lopesul-dashboard && node check-sessoes.js'
```

**Ver logs do relay:**
```bash
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'pm2 logs mikrotik-relay --lines 30 --nostream | tail -30'
```

