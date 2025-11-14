// Upload redirect.html via FTP para Mikrotik
import ftp from 'basic-ftp';
import fs from 'fs';

const config = {
  host: process.env.MIKROTIK_HOST || '10.200.200.2',
  user: process.env.MIKROTIK_USER || 'relay',
  password: process.env.MIKROTIK_PASS || 'api2025',
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
    setTimeout(function() {
      window.location.href = "https://cativo.lopesuldashboardwifi.com/pagamento.html?ip=$(ip)&mac=$(mac)&session=$(session-id)&username=$(username)&gw=$(gateway-address)&ap=$(identity)";
    }, 100);
  </script>
</body>
</html>`;

console.log('📤 Fazendo upload via FTP para Mikrotik...\n');

async function main() {
  const client = new ftp.Client();
  client.ftp.verbose = true;

  try {
    // 1. Conectar
    console.log(`1️⃣  Conectando em ${config.host}...`);
    await client.access({
      host: config.host,
      user: config.user,
      password: config.password,
      secure: false,
    });
    console.log('   ✅ Conectado!\n');

    // 2. Listar arquivos
    console.log('2️⃣  Listando diretório raiz...');
    const list = await client.list();
    console.log(`   Arquivos/pastas: ${list.length}`);
    
    const hotspotDir = list.find(f => f.name === 'hotspot');
    if (hotspotDir) {
      console.log('   ✅ Pasta "hotspot" encontrada\n');
    } else {
      console.log('   ⚠️  Pasta "hotspot" NÃO encontrada\n');
    }

    // 3. Criar arquivo temporário
    console.log('3️⃣  Criando arquivo temporário...');
    const tmpFile = '/tmp/redirect.html';
    fs.writeFileSync(tmpFile, redirectHtml, 'utf8');
    console.log(`   ✅ Arquivo criado: ${tmpFile}\n`);

    // 4. Upload
    console.log('4️⃣  Fazendo upload para hotspot/redirect.html...');
    try {
      await client.uploadFrom(tmpFile, 'hotspot/redirect.html');
      console.log('   ✅ Upload concluído!\n');
    } catch (e) {
      console.log(`   ⚠️  Erro no upload: ${e.message}`);
      console.log('   Tentando criar na raiz...');
      await client.uploadFrom(tmpFile, 'redirect.html');
      console.log('   ✅ Upload na raiz concluído!\n');
    }

    // 5. Verificar
    console.log('5️⃣  Verificando arquivos...');
    const listAfter = await client.list();
    const uploaded = listAfter.find(f => f.name.includes('redirect.html'));
    if (uploaded) {
      console.log(`   ✅ Arquivo encontrado: ${uploaded.name} (${uploaded.size} bytes)\n`);
    } else {
      console.log('   ⚠️  Arquivo não encontrado na listagem\n');
    }

    // Limpar
    fs.unlinkSync(tmpFile);
    
    console.log('✅ Concluído!\n');
    console.log('🔄 Próximos passos:');
    console.log('   1. Desconectar e reconectar no WiFi');
    console.log('   2. Abrir http://neverssl.com');
    console.log('   3. Deve redirecionar para o portal COM ip= e mac=\n');

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
