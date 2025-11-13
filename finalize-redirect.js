// Script para mover redirect.html para a pasta hotspot

import MikroNode from 'mikronode-ng2';

console.log('📁 Finalizando configuração do redirect.html\n');

function getConnection() {
  return new MikroNode.Connection({
    host: process.env.MIKROTIK_HOST || '10.200.200.2',
    port: Number(process.env.MIKROTIK_PORT || 8728),
    user: process.env.MIKROTIK_USER || 'relay',
    password: process.env.MIKROTIK_PASS || 'api2025',
    timeout: 10000,
  });
}

async function main() {
  const conn = getConnection();
  
  try {
    console.log('1️⃣  Conectando ao MikroTik...');
    await conn.connect();
    const chan = conn.openChannel();
    console.log('   ✅ Conectado!\n');
    
    // Listar arquivos
    console.log('2️⃣  Listando arquivos...');
    const filesResult = await chan.write('/file/print');
    console.log('   Debug - tipo:', typeof filesResult);
    console.log('   Debug - é array?:', Array.isArray(filesResult));
    console.log('   Debug - keys:', filesResult ? Object.keys(filesResult).slice(0, 5) : 'null');
    
    const files = Array.isArray(filesResult) ? filesResult : (filesResult?.data || []);
    
    console.log(`   Encontrados ${files.length} arquivos`);
    if (files.length > 0) {
      console.log('   Primeiro arquivo:', JSON.stringify(files[0], null, 2));
    }
    console.log();
    
    // Procurar redirect.html na raiz
    const redirectFile = files.find(f => f && f.name === 'redirect.html');
    if (!redirectFile) {
      console.log('   ❌ Arquivo redirect.html não encontrado!');
      conn.close();
      return;
    }
    
    console.log(`   ✅ Arquivo encontrado: ${redirectFile.name}`);
    console.log(`      ID: ${redirectFile['.id']}`);
    console.log(`      Tamanho: ${redirectFile.size} bytes\n`);
    
    // Mover para hotspot/redirect.html
    console.log('3️⃣  Movendo para hotspot/redirect.html...');
    await chan.write(`/file/set =.id=${redirectFile['.id']} =name=hotspot/redirect.html`);
    console.log('   ✅ Arquivo movido!\n');
    
    // Verificar
    console.log('4️⃣  Verificando resultado...');
    const filesAfter = await chan.write('/file/print');
    const finalFile = filesAfter.find(f => f.name && (f.name === 'hotspot/redirect.html' || f.name.includes('redirect')));
    
    if (finalFile) {
      console.log(`   ✅ Sucesso! Arquivo: ${finalFile.name}\n`);
      console.log('🎉 redirect.html configurado com sucesso!');
      console.log('\n📋 Próximo passo:');
      console.log('   Conecte um celular no WiFi e acesse http://neverssl.com');
      console.log('   Deve redirecionar para o portal com ?mac= e &ip=');
    } else {
      console.log('   ⚠️  Arquivo não encontrado após mover');
    }
    
    conn.close();
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    console.error(error);
    conn.close();
    process.exit(1);
  }
}

main();
