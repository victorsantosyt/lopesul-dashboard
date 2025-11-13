// Remover portal do walled garden para forçar redirect

import MikroNode from 'mikronode-ng2';

const conn = new MikroNode.Connection({
  host: '10.200.200.2',
  port: 8728,
  user: 'relay',
  password: 'api2025',
  timeout: 10000
});

console.log('🔧 Corrigindo Walled Garden\n');

async function main() {
  await conn.connect();
  console.log('✅ Conectado!\n');
  
  const chan = conn.openChannel();
  
  console.log('🗑️  Removendo cativo.lopesuldashboardwifi.com do walled garden...');
  console.log('   (Isso força o cliente a passar pelo redirect do hotspot)\n');
  
  try {
    // Remover entrada do walled garden
    await chan.write('/ip/hotspot/walled-garden/remove', [
      '=[find dst-host=cativo.lopesuldashboardwifi.com]'
    ]);
    console.log('✅ Removido!\n');
  } catch (e) {
    console.log('⚠️  Erro ou não encontrado:', e.message, '\n');
  }
  
  console.log('━'.repeat(60));
  console.log('📋 O QUE MUDOU:');
  console.log('━'.repeat(60));
  console.log('ANTES: Cliente podia acessar portal direto (HTTPS)');
  console.log('AGORA: Cliente DEVE passar pelo redirect HTTP primeiro');
  console.log('');
  console.log('Isso significa que:');
  console.log('1. Cliente conecta no WiFi');
  console.log('2. Tenta acessar QUALQUER site');
  console.log('3. É redirecionado COM ?mac= e &ip=');
  console.log('4. Só DEPOIS disso, consegue acessar o portal');
  console.log('━'.repeat(60));
  
  conn.close();
}

main().catch(e => { console.error(e); process.exit(1); });
