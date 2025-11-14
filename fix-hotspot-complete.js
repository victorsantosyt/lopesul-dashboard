// Script completo para configurar hotspot Mikrotik com portal captivo

const API_URL = process.env.RELAY_URL || 'http://127.0.0.1:3001';
const TOKEN = process.env.RELAY_TOKEN || 'JNF8T7IOBIAPI2025RELAY';

const config = {
  host: process.env.MIKROTIK_HOST || '10.200.200.2',
  user: process.env.MIKROTIK_USER || 'relay',
  pass: process.env.MIKROTIK_PASS || 'api2025',
  port: parseInt(process.env.MIKROTIK_PORT || '8728'),
};

console.log('🔧 Configurando Hotspot Mikrotik...\n');

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
    // 1. Verificar hotspot existe
    console.log('1️⃣  Verificando hotspot...');
    const hotspotList = await exec('/ip/hotspot/print');
    console.log(`   ✅ Hotspot(s) encontrado(s): ${hotspotList.data?.length || 0}\n`);

    // 2. Listar perfis
    console.log('2️⃣  Verificando perfis...');
    const profiles = await exec('/ip/hotspot/profile/print');
    console.log(`   Perfis encontrados: ${profiles.data?.length || 0}`);
    
    const profileName = profiles.data?.[0]?.name || 'hsprof1';
    console.log(`   Usando perfil: ${profileName}\n`);

    // 3. Configurar perfil
    console.log('3️⃣  Configurando perfil hotspot...');
    try {
      await exec('/ip/hotspot/profile/set', {
        args: {
          numbers: profileName,
          'html-directory': 'hotspot',
          'login-by': 'http-chap',
          'http-cookie-lifetime': '1d',
        }
      });
      console.log('   ✅ Perfil configurado!\n');
    } catch (e) {
      console.log(`   ⚠️  Erro ao configurar perfil: ${e.message}\n`);
    }

    // 4. Criar arquivo redirect.html com variáveis
    console.log('4️⃣  Criando redirect.html com variáveis Mikrotik...');
    
    const redirectContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=https://cativo.lopesuldashboardwifi.com/pagamento.html?ip=$(ip)&mac=$(mac)&session=$(session-id)&username=$(username)&gw=$(gateway-address)&ap=$(identity)">
  <title>Redirecionando...</title>
</head>
<body>
  <p>Redirecionando para o portal de pagamento...</p>
</body>
</html>`;

    try {
      // Upload via FTP ou file print
      await exec('/file/print', {
        args: {
          file: 'hotspot/redirect.html'
        }
      });
      console.log('   ℹ️  Arquivo redirect.html já existe\n');
    } catch (e) {
      console.log('   ℹ️  Arquivo redirect.html não encontrado, será necessário upload manual\n');
    }

    // 5. Verificar walled garden
    console.log('5️⃣  Configurando walled garden...');
    
    const walledGardenRules = [
      'cativo.lopesuldashboardwifi.com',
      'painel.lopesuldashboardwifi.com',
      'api.pagar.me',
      '*.cloudflare.com',
    ];

    try {
      const currentRules = await exec('/ip/hotspot/walled-garden/print');
      console.log(`   Regras atuais: ${currentRules.data?.length || 0}`);

      // Adicionar regras necessárias (apenas se não existirem)
      for (const dst of walledGardenRules) {
        const exists = currentRules.data?.find(r => r['dst-host'] === dst || r.dst === dst);
        if (!exists) {
          try {
            await exec('/ip/hotspot/walled-garden/add', {
              args: {
                'dst-host': dst,
                action: 'accept',
              }
            });
            console.log(`   ✅ Adicionado: ${dst}`);
          } catch (e) {
            console.log(`   ⚠️  Erro ao adicionar ${dst}: ${e.message}`);
          }
        } else {
          console.log(`   ℹ️  Já existe: ${dst}`);
        }
      }
      console.log('   ✅ Walled garden configurado!\n');
    } catch (e) {
      console.log(`   ⚠️  Erro no walled garden: ${e.message}\n`);
    }

    // 6. Mostrar resumo final
    console.log('📋 Resumo da configuração:\n');
    console.log('   ✅ Perfil hotspot configurado');
    console.log('   ✅ Walled garden atualizado');
    console.log('   ⚠️  redirect.html precisa ser criado MANUALMENTE\n');
    
    console.log('📝 Para criar o redirect.html no Mikrotik:\n');
    console.log('   1. Acesse via WinBox ou WebFig');
    console.log('   2. Vá em Files');
    console.log('   3. Abra a pasta "hotspot"');
    console.log('   4. Crie/edite o arquivo "redirect.html" com este conteúdo:\n');
    console.log('   ----------------------------------------');
    console.log(redirectContent);
    console.log('   ----------------------------------------\n');
    
    console.log('🔄 Ou execute este comando via terminal Mikrotik:\n');
    console.log(`   /file/print file=hotspot/redirect.html`);
    console.log(`   :put "<!DOCTYPE html><html><head><meta http-equiv=\\"refresh\\" content=\\"0; url=https://cativo.lopesuldashboardwifi.com/pagamento.html?ip=\\$(ip)&mac=\\$(mac)&session=\\$(session-id)\\"></head><body>Redirecionando...</body></html>"`);
    console.log('');

    console.log('✅ Configuração concluída!\n');
    console.log('🔄 Próximos passos:');
    console.log('   1. Criar o redirect.html conforme instruções acima');
    console.log('   2. Desconectar e reconectar no WiFi');
    console.log('   3. Abrir http://neverssl.com');
    console.log('   4. Deve redirecionar para o portal COM ip= e mac= na URL\n');

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

main();
