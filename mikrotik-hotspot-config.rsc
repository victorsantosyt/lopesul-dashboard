# ===================================================
# CONFIGURAÇÃO MIKROTIK - CAPTIVE PORTAL LOPESUL
# ===================================================

# 1. WALLED GARDEN - Permitir acesso ao captive portal sem autenticação
/ip hotspot walled-garden
add dst-host=api.67-211-212-18.sslip.io comment="Captive Portal"
add dst-host=67.211.212.18 comment="Captive Portal IP"
add dst-host=dashboard.67-211-212-18.sslip.io comment="Dashboard"
add dst-host=api.pagar.me comment="Pagar.me API"
add dst-host=pix.stone.com.br comment="PIX Stone"
add dst-host=*.bcb.pix comment="Bacen PIX"

# 2. FIREWALL ADDRESS LIST - Lista de clientes pagos
/ip firewall address-list
# A lista 'paid_clients' será populada automaticamente via API

# 3. FIREWALL FILTER - Controle de acesso
/ip firewall filter
add chain=forward src-address=10.0.0.0/24 src-address-list=paid_clients action=accept \
    comment="Liberar internet para clientes pagos"
add chain=forward src-address=10.0.0.0/24 protocol=udp dst-port=53 action=accept \
    comment="Permitir DNS para todos"
add chain=forward src-address=10.0.0.0/24 dst-address=67.211.212.18 action=accept \
    comment="Permitir acesso ao captive portal"
add chain=forward src-address=10.0.0.0/24 dst-host=api.pagar.me action=accept \
    comment="Permitir Pagar.me"
add chain=forward src-address=10.0.0.0/24 dst-host=pix.stone.com.br action=accept \
    comment="Permitir PIX Stone"
add chain=forward src-address=10.0.0.0/24 action=drop \
    comment="Bloquear resto até pagar"

# 4. FIREWALL NAT - Redirecionar HTTP para captive portal
/ip firewall nat
add chain=dstnat src-address=10.0.0.0/24 src-address-list=!paid_clients \
    protocol=tcp dst-port=80 action=dst-nat \
    to-addresses=67.211.212.18 to-ports=80 \
    comment="Redirect HTTP to Captive Portal"

# 5. DHCP - Configurar DNS e gateway
/ip dhcp-server network
set [find address=10.0.0.0/24] gateway=10.0.0.1 dns-server=8.8.8.8,8.8.4.4

# 6. HOTSPOT - Página de login customizada (HTML que você enviou)
/ip hotspot profile
set [find name=default] html-directory=hotspot login-by=http-chap

# NOTA: Coloque o HTML do captive portal em /hotspot/login.html no MikroTik
