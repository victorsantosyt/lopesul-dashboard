// Criar redirect.html no Mikrotik via API (usando /system/script/run)

const API_URL = process.env.RELAY_URL || 'http://127.0.0.1:3001';
const TOKEN = process.env.RELAY_TOKEN || 'JNF8T7IOBIAPI2025RELAY';

const config = {
  host: process.env.MIKROTIK_HOST || '10.200.200.2',
  user: process.env.MIKROTIK_USER || 'relay',
  pass: process.env.MIKROTIK_PASS || 'api2025',
  port: parseInt(process.env.MIKROTIK_PORT || '8728'),
};

// Conteúdo do redirect.html (escapado para script Mikrotik)
const redirectContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=https://cativo.lopesuldashboardwifi.com/pagamento.html?ip=\$(ip)&mac=\$(mac)&session=\$(session-id)&username=\$(username)&gw=\$(gateway-address)&ap=\$(identity)">
  <title>Redirecionando...</title>
</head>
<body>
  <p>Redirecionando para o portal de pagamento...</p>
</body>
</html>`;

console.log('📝 Criando redirect.html no Mikrotik via API...\n');

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
    // 1. Verificar perfil hotspot e descobrir o html-directory correto
    console.log('1️⃣  Verificando perfis hotspot...');
    const profiles = await exec('/ip/hotspot/profile/print');
    
    let targetDir = 'hotspot';
    for (const profile of profiles.data || []) {
      if (profile.name === 'hotspot-lopesul' || profile.name === 'default') {
        console.log(`   Perfil encontrado: ${profile.name}`);
        console.log(`   html-directory: ${profile['html-directory'] || 'não definido'}`);
        if (profile['html-directory']) {
          targetDir = profile['html-directory'];
        }
      }
    }
    console.log(`   → Usando diretório: ${targetDir}\n`);

    // 2. Criar script temporário no Mikrotik que gera o arquivo
    console.log('2️⃣  Criando script temporário no Mikrotik...');
    
    const scriptName = 'temp-create-redirect';
    const scriptContent = `:local content "${redirectContent.replace(/\n/g, '\\n').replace(/"/g, '\\"')}"
:local filename "${targetDir}/redirect.html"
/file remove [find name="\$filename"]
:delay 1s
/tool fetch mode=https url="https://cativo.lopesuldashboardwifi.com" dst-path="\$filename"
:delay 1s
/file set "\$filename" contents="\$content"`;

    try {
      // Adicionar script
      await exec('/system/script/add', {
        args: {
          name: scriptName,
          source: scriptContent,
        }
      });
      console.log('   ✅ Script criado!\n');
    } catch (e) {
      console.log(`   ⚠️  Erro ao criar script: ${e.message}`);
      console.log('   Tentando remover script antigo...\n');
      
      try {
        const scripts = await exec('/system/script/print');
        const oldScript = scripts.data?.find(s => s.name === scriptName);
        if (oldScript && oldScript['.id']) {
          await exec('/system/script/remove', {
            args: { '.id': oldScript['.id'] }
          });
          console.log('   ✅ Script antigo removido\n');
          
          // Tentar criar novamente
          await exec('/system/script/add', {
            args: {
              name: scriptName,
              source: scriptContent,
            }
          });
          console.log('   ✅ Script criado!\n');
        }
      } catch (e2) {
        console.log(`   ❌ Erro: ${e2.message}\n`);
      }
    }

    // 3. Executar o script
    console.log('3️⃣  Executando script para criar arquivo...');
    try {
      await exec('/system/script/run', {
        args: { number: scriptName }
      });
      console.log('   ✅ Script executado!\n');
    } catch (e) {
      console.log(`   ⚠️  Erro ao executar: ${e.message}\n`);
    }

    // 4. Método alternativo: usar /file/set diretamente
    console.log('4️⃣  Método alternativo: tentando /file/set...');
    try {
      // Primeiro, verificar se já existe algum redirect.html
      const files = await exec('/file/print');
      const existingFile = files.data?.find(f => 
        f.name?.includes('redirect.html') || f.name?.includes('redirect')
      );
      
      if (existingFile) {
        console.log(`   Arquivo encontrado: ${existingFile.name}`);
        
        // Tentar modificar conteúdo
        try {
          await exec('/file/set', {
            args: {
              '.id': existingFile['.id'],
              contents: redirectContent,
            }
          });
          console.log('   ✅ Conteúdo atualizado!\n');
        } catch (e) {
          console.log(`   ⚠️  /file/set não suportado: ${e.message}\n`);
        }
      } else {
        console.log('   ℹ️  Nenhum arquivo redirect existente encontrado\n');
      }
    } catch (e) {
      console.log(`   ⚠️  Erro: ${e.message}\n`);
    }

    // 5. Método SSH: usar /tool/fetch com data inline
    console.log('5️⃣  Método SSH: criando via echo e redirecionamento...');
    console.log('   ℹ️  Requer acesso SSH direto ao Mikrotik\n');

    // 6. Resumo final
    console.log('📋 Resumo:\n');
    console.log(`   Diretório alvo: ${targetDir}`);
    console.log(`   Arquivo: ${targetDir}/redirect.html\n`);
    
    console.log('🔧 SOLUÇÃO DEFINITIVA via SSH:\n');
    console.log(`   ssh ${config.user}@${config.host}`);
    console.log('   Depois, execute:\n');
    console.log(`   /file remove [find name~"redirect.html"]`);
    console.log(`   :put "Arquivo removido"\n`);
    
    console.log('   Agora crie o arquivo com FTP ou WinBox:');
    console.log(`   - Caminho: ${targetDir}/redirect.html`);
    console.log(`   - Conteúdo abaixo:\n`);
    console.log('   ----------------------------------------');
    console.log(redirectContent);
    console.log('   ----------------------------------------\n');

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

main();
