# ===================================================================
# Configuração Completa MikroTik para Sistema Lopesul WiFi
# Execute estes comandos no terminal do MikroTik (WinBox ou SSH)
# ===================================================================

# 1. CRIAR USUÁRIO API (para o relay service se conectar)
/user add name=relay password=api2025 group=full comment="API user for VPS relay"

# 2. HABILITAR SERVIÇOS (API e SSH apenas para rede WireGuard)
/ip service set api address=10.200.200.0/24 port=8728 disabled=no
/ip service set ssh address=10.200.200.0/24 port=22 disabled=no

# 3. LIMPAR REGRAS DUPLICADAS DE FIREWALL
/ip firewall filter remove [find where comment="SSH from VPS" and chain=input]
/ip firewall filter remove [find where comment="API from VPS" and chain=input]
/ip firewall filter remove [find where comment="ICMP from VPS" and chain=input]
/ip firewall filter remove [find where comment="allow WG input" and chain=input]
/ip firewall filter remove [find where comment="allow API 8728 from VPS" and chain=input]
/ip firewall filter remove [find where comment="allow SSH 22 from VPS" and chain=input]

# 4. GARANTIR REGRA DE FIREWALL NO TOPO
:local foundRule [/ip firewall filter find where comment="Accept all from VPS" and chain=input]
:if ([:len $foundRule] > 0) do={
  /ip firewall filter move $foundRule destination=0
}

# 5. VERIFICAR ROTA PARA VPS (já deve existir)
/ip route print where dst-address=10.200.200.1/32

# 6. CONFIGURAR NTP (sincronização de horário - importante para logs)
/system ntp client set enabled=yes servers=pool.ntp.org

# 7. CONFIGURAR DNS
/ip dns set servers=8.8.8.8,8.8.4.4 allow-remote-requests=yes

# 8. VERIFICAR POOL DHCP (se não existir, criar)
:if ([:len [/ip pool find where name="dhcp_pool1"]] = 0) do={
  /ip pool add name=dhcp_pool1 ranges=192.168.88.10-192.168.88.254
}

# 9. VERIFICAR DHCP SERVER (se não existir, criar)
:if ([:len [/ip dhcp-server find where interface=bridge]] = 0) do={
  /ip dhcp-server add name=dhcp1 interface=bridge address-pool=dhcp_pool1 lease-time=1h disabled=no
  /ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=8.8.8.8,8.8.4.4
}

# ===================================================================
# VERIFICAÇÕES FINAIS
# ===================================================================

:put "=== Configuração concluída! ==="
:put ""
:put "1. Usuário API:"
/user print where name="relay"

:put ""
:put "2. Serviços habilitados:"
/ip service print where name~"api|ssh"

:put ""
:put "3. Firewall (primeiras 5 regras):"
/ip firewall filter print where chain=input from=0 to=4

:put ""
:put "4. Rotas:"
/ip route print where dst-address~"10.200.200"

:put ""
:put "5. WireGuard peer:"
/interface wireguard peers print detail

:put ""
:put "6. Teste de ping para VPS:"
/ping 10.200.200.1 count=3

:put ""
:put "=== Sistema pronto para uso! ==="
:put "VPS pode acessar:"
:put "  - SSH: 67.211.212.18:2222"
:put "  - API: 67.211.212.18:28728"
:put ""
:put "Credenciais API:"
:put "  - User: relay"
:put "  - Pass: api2025"
:put "  - Host: 10.200.200.2"
:put "  - Port: 8728"
