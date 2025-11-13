# 🚌 Setup Completo - Wi-Fi Lopesul

## 📋 Cenários de Uso

### ✅ Cenário 1: Cliente com 4G
1. Cliente escaneia QR code com celular usando 4G
2. Abre página: `https://dashboard.67-211-212-18.sslip.io/pagar.html`
3. Escolhe plano e paga
4. Conecta ao Wi-Fi "Lopesul Wi-Fi"
5. Internet liberada automaticamente

### ✅ Cenário 2: Cliente sem 4G (somente Wi-Fi)
1. Cliente conecta ao Wi-Fi "Lopesul Wi-Fi"
2. Abre qualquer site
3. É redirecionado automaticamente para: `http://api.67-211-212-18.sslip.io/pagamento.html`
4. Escolhe plano e paga
5. Internet liberada automaticamente

### ✅ Cenário 3: Cliente dentro do ônibus
- Se tiver 4G: segue cenário 1
- Se não tiver 4G: segue cenário 2

---

## 🔧 Configuração do MikroTik

### 1. Importar configuração base
```bash
# No terminal do MikroTik
/import file=mikrotik-hotspot-config.rsc
```

### 2. Configurar página de login customizada
No MikroTik, vá em **IP > Hotspot > Server Profiles**

Cole este HTML em **HTML Directory > login.html**:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0;url=http://api.67-211-212-18.sslip.io/pagamento.html?mac=$(mac)&ip=$(ip)">
    <script>
      (function(){
        var u = "http://api.67-211-212-18.sslip.io/pagamento.html?mac="+encodeURIComponent("$(mac)")+"&ip="+encodeURIComponent("$(ip)");
        location.replace(u);
      })();
    </script>
  </head>
  <body></body>
</html>
```

### 3. Configurar Walled Garden
Adicione estes domínios no **IP > Hotspot > Walled Garden**:

```
api.67-211-212-18.sslip.io
67.211.212.18
dashboard.67-211-212-18.sslip.io
api.pagar.me
pix.stone.com.br
*.bcb.gov.br
```

### 4. Verificar Firewall Rules
Certifique-se que as regras estão nesta ordem:

```
1. ACCEPT - src-address-list=paid_clients
2. ACCEPT - protocol=udp dst-port=53 (DNS)
3. ACCEPT - dst-address=67.211.212.18 (Captive Portal)
4. ACCEPT - dst-host=api.pagar.me (Pagamentos)
5. ACCEPT - dst-host=pix.stone.com.br (PIX)
6. DROP - src-address=10.0.0.0/24 (Bloquear resto)
```

### 5. Configurar NAT Redirect
Em **IP > Firewall > NAT**, adicione:

```
chain=dstnat
src-address=10.0.0.0/24
src-address-list=!paid_clients
protocol=tcp
dst-port=80
action=dst-nat
to-addresses=67.211.212.18
to-ports=80
```

---

## 🌐 URLs Públicas

### Para QR Code (acesso via 4G):
```
https://dashboard.67-211-212-18.sslip.io/pagar.html
```

### Para captive portal (redirecionamento automático):
```
http://api.67-211-212-18.sslip.io/pagamento.html
```

---

## 🧪 Como Testar

### Teste 1: Via 4G
1. Desconecte do Wi-Fi
2. Acesse: `https://dashboard.67-211-212-18.sslip.io/pagar.html`
3. Clique em "Estou usando 4G"
4. Faça o pagamento
5. Conecte ao Wi-Fi
6. Verifique se tem internet

### Teste 2: Somente Wi-Fi
1. Conecte ao Wi-Fi "Lopesul Wi-Fi"
2. Abra: `http://google.com`
3. Deve redirecionar automaticamente para o captive portal
4. Faça o pagamento
5. Verifique se tem internet

### Teste 3: Verificar cliente autorizado
```bash
# Via SSH no servidor
curl http://localhost:3001/address-lists -H "Authorization: Bearer JNF8T7IOBI"
```

---

## 🔍 Troubleshooting

### Cliente não é redirecionado
- Verifique NAT redirect no MikroTik
- Verifique walled garden
- Teste: `curl -I http://google.com` (deve retornar 302)

### Pagamento não libera internet
- Verifique logs: `journalctl -u lopesul-dashboard -f`
- Verifique se IP/MAC foram salvos no banco
- Verifique firewall address-list no MikroTik

### Página carrega branca
- Verifique nginx: `nginx -t && systemctl status nginx`
- Verifique assets estão carregando: F12 > Network

---

## 📱 QR Code para Imprimir

Cole no ônibus para clientes com 4G:

```
URL: https://dashboard.67-211-212-18.sslip.io/pagar.html
```

Use este site para gerar: https://www.qr-code-generator.com/

---

## ✅ Checklist Final

- [ ] MikroTik configurado (hotspot + walled garden)
- [ ] Firewall rules criadas
- [ ] NAT redirect configurado
- [ ] Nginx rodando e configurado
- [ ] Dashboard rodando (systemctl status lopesul-dashboard)
- [ ] Relay API rodando (PM2)
- [ ] Webhook Pagar.me configurado
- [ ] Testado cenário 4G
- [ ] Testado cenário Wi-Fi only
- [ ] QR code impresso e colado no ônibus
