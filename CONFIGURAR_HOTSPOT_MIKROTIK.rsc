# ===================================================================
# Configuração do Hotspot (Portal Cativo) - MikroTik
# Execute no terminal do MikroTik (WinBox ou SSH)
# ===================================================================

# IMPORTANTE: Ajuste os valores conforme sua necessidade
# - Interface: bridge (interface onde os clientes conectam)
# - IP Pool: range de IPs para clientes
# - URL de redirecionamento: portal de pagamento

# 1. CRIAR PERFIL DO HOTSPOT
/ip hotspot profile
add name=hotspot-lopesul \
    login-by=http-pap \
    use-radius=no \
    rate-limit="" \
    keepalive-timeout=5m \
    status-autorefresh=1m \
    http-proxy="" \
    smtp-server=0.0.0.0 \
    dns-name=lopesul.wifi \
    html-directory=hotspot \
    http-cookie-lifetime=3d

# 2. CRIAR POOL DE IPS PARA HOTSPOT (se não existir)
:if ([:len [/ip pool find where name="hotspot-pool"]] = 0) do={
  /ip pool add name=hotspot-pool ranges=192.168.88.10-192.168.88.254
}

# 3. CONFIGURAR HOTSPOT NA INTERFACE BRIDGE
:if ([:len [/ip hotspot find where name="hotspot1"]] = 0) do={
  /ip hotspot add \
    name=hotspot1 \
    interface=bridge \
    address-pool=hotspot-pool \
    profile=hotspot-lopesul \
    addresses-per-mac=2 \
    keepalive-timeout=none \
    idle-timeout=5m
}

# 4. CONFIGURAR REDE DO HOTSPOT
:if ([:len [/ip hotspot network find where address=192.168.88.0/24]] = 0) do={
  /ip hotspot network add \
    address=192.168.88.0/24 \
    gateway=192.168.88.1 \
    dns-server=8.8.8.8,8.8.4.4
}

# 5. ADICIONAR WALLED GARDEN (sites permitidos sem login)
# Permitir acesso ao portal de pagamento e APIs necessárias
/ip hotspot walled-garden
add dst-host=cativo.lopesuldashboardwifi.com comment="Portal de pagamento"
add dst-host=painel.lopesuldashboardwifi.com comment="API backend"
add dst-host=*.pagar.me comment="API Pagar.me"
add dst-host=api.pagar.me comment="API Pagar.me"
add dst-host=*.cloudflare.com comment="CDN assets"
add dst-host=*.googleapis.com comment="Google APIs"

# 6. CONFIGURAR REDIRECIONAMENTO PARA PORTAL CATIVO
/ip hotspot profile set hotspot-lopesul \
    login-by=http-pap \
    html-directory=hotspot

# 7. PERSONALIZAR PÁGINA DE LOGIN (opcional - redirecionar para portal externo)
# Criar arquivo /hotspot/login.html personalizado que redireciona para:
# https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=$(mac)&ip=$(ip)

# OU usar redirecionamento automático:
/ip hotspot profile set hotspot-lopesul \
    login-by=http-chap,http-pap \
    use-radius=no

# 8. ADICIONAR USUÁRIO PADRÃO (bypass - opcional)
# /ip hotspot user add name=bypass password=bypass profile=default

# ===================================================================
# VERIFICAÇÕES
# ===================================================================

:put "=== Configuração Hotspot concluída! ==="
:put ""

:put "1. Perfil Hotspot:"
/ip hotspot profile print where name="hotspot-lopespal"

:put ""
:put "2. Hotspot ativo:"
/ip hotspot print

:put ""
:put "3. Rede Hotspot:"
/ip hotspot network print where address~"192.168.88"

:put ""
:put "4. Walled Garden (sites permitidos):"
/ip hotspot walled-garden print

:put ""
:put "5. Pool de IPs:"
/ip pool print where name="hotspot-pool"

:put ""
:put "=== INSTRUÇÕES ==="
:put "1. Clientes que conectarem no WiFi serão redirecionados automaticamente"
:put "2. Portal cativo: https://cativo.lopesuldashboardwifi.com/pagamento.html"
:put "3. Após pagamento, o sistema libera o MAC do cliente automaticamente"
:put ""
:put "Para testar:"
:put "  - Conecte um dispositivo no WiFi"
:put "  - Tente acessar qualquer site"
:put "  - Você será redirecionado para o portal de pagamento"

# ===================================================================
# CUSTOMIZAÇÃO AVANÇADA (OPCIONAL)
# ===================================================================

# Para personalizar a página de login do MikroTik e redirecionar para o portal:
# 1. Acesse Files no WinBox
# 2. Entre na pasta /hotspot
# 3. Edite o arquivo login.html
# 4. Adicione redirecionamento JavaScript:
#    <script>
#      window.location.href = "https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=" + "$(mac)";
#    </script>

# OU use o método HTTP redirect direto:
/ip hotspot profile set hotspot-lopesul \
    http-cookie-lifetime=3d \
    login-by=http-pap

:put ""
:put "✅ Sistema Hotspot pronto!"
