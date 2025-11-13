#!/usr/bin/env node

import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const MikroNode = require('mikronode');

const MIKROTIK_HOST = '10.200.200.2';
const MIKROTIK_PORT = 8728;
const MIKROTIK_USER = 'relay';
const MIKROTIK_PASS = 'api2025';

console.log('📤 Fazendo upload do redirect.html para o MikroTik\n');

const device = MikroNode.getConnection(MIKROTIK_HOST, MIKROTIK_USER, MIKROTIK_PASS, {
  port: MIKROTIK_PORT,
  timeout: 10
});

device.connect().then(() => {
  console.log('✅ Conectado ao MikroTik!\n');
  
  const channel = device.openChannel();
  
  // Ler o conteúdo do arquivo
  const content = `<html>
<head>
<meta http-equiv="refresh" content="0; url=https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=$(mac)&ip=$(ip)&link-orig=$(link-orig-esc)">
<title>Redirecionando...</title>
</head>
<body>
<h2>Aguarde, redirecionando para o portal de pagamento...</h2>
</body>
</html>`;
  
  console.log('📝 Criando arquivo redirect.html via /file/set...');
  
  // MikroTik não tem comando direto para upload via API
  // Precisamos usar FTP ou criar via SSH
  console.log('\n⚠️  A API MikroTik não suporta upload direto de arquivos.');
  console.log('   Vou usar FTP para fazer o upload...\n');
  
  device.close();
  
  // Vamos usar curl com FTP
  const { exec } = require('child_process');
  
  exec(`echo '${content}' | curl -T - ftp://10.200.200.2/hotspot/redirect.html --user relay:api2025`, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Erro no upload FTP:', error.message);
      
      console.log('\n🔧 Tentando método alternativo via SFTP...\n');
      
      // Criar script expect para FTP interativo
      const ftpScript = `#!/usr/bin/expect -f
set timeout 30
spawn ftp 10.200.200.2
expect "Name"
send "admin\\r"
expect "Password:"
send "\\r"
expect "ftp>"
send "binary\\r"
expect "ftp>"
send "cd hotspot\\r"
expect "ftp>"
send "put /tmp/redirect.html redirect.html\\r"
expect "ftp>"
send "bye\\r"
expect eof
`;
      
      require('fs').writeFileSync('/tmp/ftp-upload.exp', ftpScript);
      exec('chmod +x /tmp/ftp-upload.exp && /tmp/ftp-upload.exp', (err2, stdout2, stderr2) => {
        if (err2) {
          console.error('❌ Erro no SFTP:', err2.message);
          console.log('\n📋 Execute manualmente na VPS:');
          console.log('ftp 10.200.200.2');
          console.log('login: admin');
          console.log('password: (Enter)');
          console.log('binary');
          console.log('cd hotspot');
          console.log('put /tmp/redirect.html redirect.html');
          console.log('bye');
        } else {
          console.log('✅ Upload realizado com sucesso!');
          console.log(stdout2);
        }
      });
    } else {
      console.log('✅ Upload realizado com sucesso via FTP!');
      console.log(stdout);
    }
  });
  
}).catch(err => {
  console.error('❌ Erro ao conectar:', err.message);
  process.exit(1);
});
