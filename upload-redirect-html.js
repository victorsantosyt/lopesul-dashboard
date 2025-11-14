// Upload do arquivo redirect.html para o Mikrotik

const API_URL = process.env.RELAY_URL || 'http://127.0.0.1:3001';
const TOKEN = process.env.RELAY_TOKEN || 'JNF8T7IOBIAPI2025RELAY';

const config = {
  host: process.env.MIKROTIK_HOST || '10.200.200.2',
  user: process.env.MIKROTIK_USER || 'relay',
  pass: process.env.MIKROTIK_PASS || 'api2025',
  port: parseInt(process.env.MIKROTIK_PORT || '8728'),
};

const redirectHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=https://cativo.lopesuldashboardwifi.com/pagamento.html?ip=$(ip)&mac=$(mac)&session=$(session-id)&username=$(username)&gw=$(gateway-address)&ap=$(identity)">
  <title>Redirecionando...</title>
</head>
<body>
  <p>Redirecionando para o portal de pagamento...</p>
  <script>
    // Fallback se meta refresh não funcionar
    setTimeout(function() {
      window.location.href = "https://cativo.lopesuldashboardwifi.com/pagamento.html?ip=$(ip)&mac=$(mac)&session=$(session-id)&username=$(username)&gw=$(gateway-address)&ap=$(identity)";
    }, 100);
  </script>
</body>
</html>`;

console.log('📤 Fazendo upload do redirect.html para o Mikrotik...\n');

async function exec(command, args = {}) {
  const res = await fetch(`${API_URL}/relay/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      host: config.host,
      user: config.user,
      pass: config.pass,
      port: config.port,
      command,
      ...args,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Relay error: ${res.status} - ${text}`);
  }

  return res.json();
}

async function main() {
  try {
    // 1. Verificar arquivos atuais
    console.log('1️⃣  Listando arquivos hotspot...');
    const files = await exec('/file/print', {
      args: {
        where: 'name~"hotspot"'
      }
    });
    console.log(`   Arquivos encontrados: ${files.data?.length || 0}\n`);

    // 2. Remover redirect.html antigo se existir
    console.log('2️⃣  Removendo redirect.html antigo...');
    const oldRedirect = files.data?.find(f => f.name?.includes('redirect.html'));
    if (oldRedirect && oldRedirect['.id']) {
      try {
        await exec('/file/remove', {
          args: {
            numbers: oldRedirect['.id']
          }
        });
        console.log('   ✅ Arquivo antigo removido\n');
      } catch (e) {
        console.log(`   ⚠️  Erro ao remover: ${e.message}\n`);
      }
    } else {
      console.log('   ℹ️  Nenhum arquivo antigo encontrado\n');
    }

    // 3. Criar novo redirect.html
    console.log('3️⃣  Criando redirect.html...');
    
    // Mikrotik não tem comando direto para criar arquivo HTML via API
    // Precisamos usar FTP ou fazer via script
    
    console.log('   ⚠️  Criação via API não suportada diretamente\n');
    console.log('📋 Instruções para criar manualmente:\n');
    console.log('   OPÇÃO 1 - Via Terminal Mikrotik:');
    console.log('   1. Conecte via SSH ou Terminal no WinBox');
    console.log('   2. Execute os comandos:\n');
    console.log('   /file print');
    console.log('   /file remove [find name~"redirect.html"]');
    console.log('   # Copie e cole este conteúdo em um arquivo local redirect.html');
    console.log('   # E faça upload via FTP/WinBox\n');
    
    console.log('   OPÇÃO 2 - Via FTP:');
    console.log(`   1. Conecte via FTP: ftp://${config.user}:${config.pass}@${config.host}`);
    console.log('   2. Navegue até a pasta "hotspot"');
    console.log('   3. Faça upload do arquivo redirect.html\n');
    
    console.log('   OPÇÃO 3 - Via WinBox:');
    console.log('   1. Abra WinBox e conecte');
    console.log('   2. Files → hotspot');
    console.log('   3. Arraste o arquivo redirect.html para a pasta\n');

    console.log('📄 Conteúdo do redirect.html:\n');
    console.log('   ----------------------------------------');
    console.log(redirectHtml);
    console.log('   ----------------------------------------\n');

    // 4. Verificar perfil do hotspot
    console.log('4️⃣  Verificando perfis hotspot...');
    const profiles = await exec('/ip/hotspot/profile/print');
    
    for (const profile of profiles.data || []) {
      console.log(`   Perfil: ${profile.name}`);
      console.log(`     html-directory: ${profile['html-directory'] || 'não definido'}`);
      console.log(`     login-by: ${profile['login-by'] || 'não definido'}`);
      
      // Tentar configurar se for o perfil ativo
      if (profile.name && profile['html-directory'] !== 'hotspot') {
        console.log(`     ⚠️  html-directory deveria ser "hotspot"!`);
        
        try {
          await exec('/ip/hotspot/profile/set', {
            args: {
              '.id': profile['.id'],
              'html-directory': 'hotspot',
              'login-by': 'http-chap',
            }
          });
          console.log(`     ✅ Perfil "${profile.name}" atualizado!\n`);
        } catch (e) {
          console.log(`     ⚠️  Erro ao atualizar: ${e.message}\n`);
        }
      }
    }

    console.log('\n✅ Verificação concluída!\n');
    console.log('🔄 Próximos passos:');
    console.log('   1. Criar o arquivo redirect.html conforme instruções acima');
    console.log('   2. Desconectar e reconectar no WiFi do ônibus');
    console.log('   3. Abrir http://neverssl.com ou qualquer site HTTP');
    console.log('   4. Verificar se redireciona para o portal COM ip= e mac= na URL\n');

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

main();
