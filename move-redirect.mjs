#!/usr/bin/env node

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const MikroNode = require('mikronode');

const MIKROTIK_HOST = '10.200.200.2';
const MIKROTIK_PORT = 8728;
const MIKROTIK_USER = 'relay';
const MIKROTIK_PASS = 'api2025';

console.log('📁 Movendo redirect.html para pasta hotspot\n');

const device = MikroNode.getConnection(MIKROTIK_HOST, MIKROTIK_USER, MIKROTIK_PASS, {
  port: MIKROTIK_PORT,
  timeout: 10
});

device.connect().then(async () => {
  console.log('✅ Conectado ao MikroTik!\n');
  
  const channel = device.openChannel();
  
  try {
    // 1. Verificar se o arquivo existe
    console.log('1️⃣  Verificando arquivos...');
    const files = await channel.write('/file/print');
    
    const redirectFile = files.find(f => f.name === 'redirect.html');
    if (!redirectFile) {
      console.log('   ❌ Arquivo redirect.html não encontrado na raiz!');
      device.close();
      return;
    }
    console.log(`   ✅ Arquivo encontrado: ${redirectFile.name} (${redirectFile.size} bytes)`);
    
    // 2. Verificar se pasta hotspot existe
    console.log('\n2️⃣  Verificando pasta hotspot...');
    const hotspotFiles = files.filter(f => f.name && f.name.startsWith('hotspot'));
    console.log(`   Encontrados ${hotspotFiles.length} arquivos/pastas hotspot`);
    
    // 3. Renomear arquivo para hotspot/redirect.html
    console.log('\n3️⃣  Movendo arquivo para hotspot/redirect.html...');
    await channel.write('/file/set', [
      `=.id=${redirectFile['.id']}`,
      '=name=hotspot/redirect.html'
    ]);
    console.log('   ✅ Arquivo movido com sucesso!');
    
    // 4. Verificar
    console.log('\n4️⃣  Verificando...');
    const filesAfter = await channel.write('/file/print');
    const finalFile = filesAfter.find(f => f.name && f.name.includes('hotspot') && f.name.includes('redirect'));
    
    if (finalFile) {
      console.log(`   ✅ Confirmado: ${finalFile.name}`);
    } else {
      console.log('   ⚠️  Arquivo não encontrado após mover');
    }
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }
  
  device.close();
  console.log('\n✅ Concluído!');
  
}).catch(err => {
  console.error('❌ Erro ao conectar:', err.message);
  process.exit(1);
});
