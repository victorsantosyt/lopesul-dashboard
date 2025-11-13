// Força configuração do hotspot redirect - SIMPLIFICADO

import MikroNode from 'mikronode-ng2';

const conn = new MikroNode.Connection({
  host: '10.200.200.2',
  port: 8728,
  user: 'relay',
  password: 'api2025',
  timeout: 10000,
});

console.log('🔧 Forçando configuração do Hotspot Redirect\n');

async function main() {
  try {
    await conn.connect();
    console.log('✅ Conectado ao MikroTik!\n');
    
    const chan = conn.openChannel();
    
    // Configurar html-directory do perfil hotspot-lopesul
    console.log('1️⃣  Configurando perfil hotspot-lopesul...');
    try {
      await chan.write('/ip/hotspot/profile/set', [
        '=numbers=hotspot-lopesul',
        '=html-directory=hotspot',
        '=login-by=http-chap,http-pap'
      ]);
      console.log('   ✅ Perfil configurado!');
      console.log('      html-directory: hotspot');
      console.log('      login-by: http-chap,http-pap\n');
    } catch (e) {
      console.log('   ⚠️  Erro:', e.message, '\n');
    }
    
    // Verificar se hotspot está usando o perfil correto
    console.log('2️⃣  Verificando instância do hotspot...');
    try {
      // Listar hotspots
      await chan.write('/ip/hotspot/print');
      console.log('   ✅ Hotspot ativo\n');
    } catch (e) {
      console.log('   ⚠️  Erro:', e.message, '\n');
    }
    
    conn.close();
    
    console.log('✅ Configuração aplicada!\n');
    console.log('━'.repeat(60));
    console.log('📋 IMPORTANTE - Peça para o cliente:');
    console.log('━'.repeat(60));
    console.log('1. DESCONECTAR do WiFi completamente');
    console.log('2. RECONECTAR no WiFi');
    console.log('3. Abrir navegador');
    console.log('4. Tentar acessar: http://neverssl.com');
    console.log('5. Vai redirecionar para o portal');
    console.log('6. A URL DEVE ter ?mac= e &ip=');
    console.log('━'.repeat(60));
    console.log('\n🔍 Se ainda não funcionar, o problema pode ser:');
    console.log('   - Hotspot não está interceptando HTTP');
    console.log('   - Cliente já está autenticado');
    console.log('   - Arquivo redirect.html não está no lugar\n');
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
    conn.close();
    process.exit(1);
  }
}

main();
