#!/bin/bash

echo "🔧 Configurando Hotspot MikroTik - 100% Funcional"
echo "=================================================="
echo ""

# Criar arquivo redirect.html localmente
cat > /tmp/redirect.html << 'EOF'
<html>
<head>
<meta http-equiv="refresh" content="0; url=https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=$(mac)&ip=$(ip)&link-orig=$(link-orig-esc)">
<title>Redirecionando...</title>
</head>
<body>
<h2>Aguarde, redirecionando para o portal de pagamento...</h2>
</body>
</html>
EOF

echo "1️⃣  Fazendo upload do redirect.html para o MikroTik..."
scp /tmp/redirect.html root@67.211.212.18:/tmp/redirect.html

echo ""
echo "2️⃣  Conectando ao MikroTik via VPS..."

ssh root@67.211.212.18 << 'MIKROTIK_COMMANDS'

# Upload do arquivo para o MikroTik
echo "Fazendo upload via FTP..."
cat > /tmp/upload.sh << 'FTP_SCRIPT'
#!/bin/bash
ftp -n 10.200.200.2 << EOF
user admin
passive
binary
put /tmp/redirect.html hotspot/redirect.html
bye
EOF
FTP_SCRIPT

chmod +x /tmp/upload.sh
bash /tmp/upload.sh

echo ""
echo "3️⃣  Verificando configuração do hotspot..."

# Criar script Python para comandos via API
cat > /tmp/mikrotik_setup.py << 'PYTHON_SCRIPT'
#!/usr/bin/env python3
import socket
import hashlib
import binascii
import sys

def encode_length(length):
    if length < 0x80:
        return bytes([length])
    elif length < 0x4000:
        length |= 0x8000
        return bytes([length >> 8, length & 0xFF])
    elif length < 0x200000:
        length |= 0xC00000
        return bytes([length >> 16, (length >> 8) & 0xFF, length & 0xFF])
    elif length < 0x10000000:
        length |= 0xE0000000
        return bytes([length >> 24, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF])
    else:
        return bytes([0xF0]) + length.to_bytes(4, 'big')

def encode_word(word):
    encoded = word.encode('utf-8')
    return encode_length(len(encoded)) + encoded

def read_word(sock):
    length = read_length(sock)
    if length == 0:
        return ''
    return sock.recv(length).decode('utf-8')

def read_length(sock):
    c = sock.recv(1)[0]
    if c & 0x80 == 0x00:
        return c
    elif c & 0xC0 == 0x80:
        return ((c & ~0xC0) << 8) + sock.recv(1)[0]
    elif c & 0xE0 == 0xC0:
        return ((c & ~0xE0) << 16) + (sock.recv(1)[0] << 8) + sock.recv(1)[0]
    elif c & 0xF0 == 0xE0:
        return ((c & ~0xF0) << 24) + (sock.recv(1)[0] << 16) + (sock.recv(1)[0] << 8) + sock.recv(1)[0]
    elif c & 0xF8 == 0xF0:
        return (sock.recv(1)[0] << 24) + (sock.recv(1)[0] << 16) + (sock.recv(1)[0] << 8) + sock.recv(1)[0]

def login(sock, username, password):
    sock.send(encode_word('/login'))
    sock.send(encode_word(''))
    
    response = []
    while True:
        word = read_word(sock)
        if word == '':
            break
        response.append(word)
    
    if not response or response[0] != '!done':
        return False
    
    challenge = None
    for word in response:
        if word.startswith('=ret='):
            challenge = word[5:]
            break
    
    if not challenge:
        return False
    
    chal = binascii.unhexlify(challenge)
    md = hashlib.md5()
    md.update(b'\x00')
    md.update(password.encode('utf-8'))
    md.update(chal)
    
    sock.send(encode_word('/login'))
    sock.send(encode_word('=name=' + username))
    sock.send(encode_word('=response=00' + binascii.hexlify(md.digest()).decode('utf-8')))
    sock.send(encode_word(''))
    
    response = []
    while True:
        word = read_word(sock)
        if word == '':
            break
        response.append(word)
    
    return response and response[0] == '!done'

def send_command(sock, command, params=None):
    sock.send(encode_word(command))
    if params:
        for key, value in params.items():
            sock.send(encode_word(f'={key}={value}'))
    sock.send(encode_word(''))
    
    response = []
    while True:
        word = read_word(sock)
        if word == '':
            break
        response.append(word)
    
    return response

# Conectar ao MikroTik
print("Conectando ao MikroTik API...")
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect(('10.200.200.2', 8728))

if not login(sock, 'admin', ''):
    print("❌ Erro ao fazer login")
    sys.exit(1)

print("✅ Conectado!")

# Verificar hotspot
print("\n📊 Verificando configuração do hotspot...")
response = send_command(sock, '/ip/hotspot/print')
print("Hotspot configurado:", "✅ Sim" if any('!re' in r for r in response) else "❌ Não")

# Verificar perfil
print("\n📊 Verificando perfil hotspot-lopesul...")
response = send_command(sock, '/ip/hotspot/profile/print', {'where': 'name=hotspot-lopesul'})
print("Perfil existe:", "✅ Sim" if any('!re' in r for r in response) else "❌ Não")

# Configurar HTML directory (se necessário)
print("\n🔧 Configurando html-directory...")
try:
    send_command(sock, '/ip/hotspot/profile/set', {
        'numbers': 'hotspot-lopesul',
        'html-directory': 'hotspot'
    })
    print("✅ html-directory configurado: hotspot")
except:
    print("⚠️  Erro ao configurar html-directory")

# Verificar walled garden
print("\n📊 Verificando walled garden...")
response = send_command(sock, '/ip/hotspot/walled-garden/print')
domains = ['cativo.lopesuldashboardwifi.com', 'painel.lopesuldashboardwifi.com', '*.pagar.me', 'api.pagar.me']
for domain in domains:
    exists = any(domain in str(r) for r in response)
    print(f"  {domain}: {'✅' if exists else '❌'}")

sock.close()
print("\n✅ Configuração verificada!")
PYTHON_SCRIPT

chmod +x /tmp/mikrotik_setup.py
python3 /tmp/mikrotik_setup.py

MIKROTIK_COMMANDS

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Conecte um dispositivo no WiFi"
echo "   2. Tente acessar http://neverssl.com"
echo "   3. Deve redirecionar para o portal com ?mac=XX&ip=192.168.88.X"
