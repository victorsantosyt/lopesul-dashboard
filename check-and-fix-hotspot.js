// Verificar e corrigir configuração completa do hotspot

import MikroNode from 'mikronode-ng2';

const conn = new MikroNode.Connection({
  host: '10.200.200.2',
  port: 8728,
  user: 'relay',
  password: 'api2025',
  timeout: 10000,
});

console.log('🔍 Verificando configuração do Hotspot MikroTik\n');

async function main() {
  try {
    await conn.connect();
    console.log('✅ Conectado!\n');
    
    const chan = conn.openChannel();
    
    // 1. Verificar arquivos
    console.log('1️⃣  Verificando arquivos...');
    await chan.write('/file/print').then(() => {
      console.log('   ✅ Comando /file/print executado\n');
    }).catch(e => console.log('   Erro:', e.message));
    
    // 2. Verificar hotspot
    console.log('2️⃣  Verificando hotspot...');
    await chan.write('/ip/hotspot/print').then(() => {
      console.log('   ✅ Hotspot está ativo\n');
    }).catch(e => console.log('   ❌ Erro:', e.message));
    
    // 3. Verificar perfil
    console.log('3️⃣  Verificando perfil hotspot-lopesul...');
    const profileCmd = await chan.write('/ip/hotspot/profile/print');
    console.log('   Resposta:', profileCmd);
    
    // 4. Garantir que html-directory está correto
    console.log('\n4️⃣  Configurando html-directory=hotspot...');
    try {
      await chan.write('/ip/hotspot/profile/set', [
        '=numbers=hotspot-lopesul',
        '=html-directory=hotspot'
      ]);
      console.log('   ✅ html-directory configurado!\n');
    } catch (e) {
      console.log('   ⚠️  Erro:', e.message, '\n');
    }
    
    // 5. Verificar se hotspot usa http-login
    console.log('5️⃣  Configurando login-by=http-chap...');
    try {
      await chan.write('/ip/hotspot/profile/set', [
        '=numbers=hotspot-lopesul',
        '=login-by=http-chap'
      ]);
      console.log('   ✅ login-by configurado!\n');
    } catch (e) {
      console.log('   ⚠️  Erro:', e.message, '\n');
    }
    
    // 6. Verificar walled garden
    console.log('6️⃣  Verificando walled garden...');
    await chan.write('/ip/hotspot/walled-garden/print').then(() => {
      console.log('   ✅ Walled garden configurado\n');
    }).catch(e => console.log('   Erro:', e.message));
    
    console.log('✅ Verificação concluída!\n');
    console.log('📋 Próximos passos:');
    console.log('   1. Cliente deve DESCONECTAR do WiFi');
    console.log('   2. RECONECTAR no WiFi');
    console.log('   3. Abrir navegador e tentar http://neverssl.com');
    console.log('   4. Deve redirecionar para portal COM ?mac= e &ip=\n');
    
    conn.close();
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
    conn.close();
    process.exit(1);
  }
}

main();
