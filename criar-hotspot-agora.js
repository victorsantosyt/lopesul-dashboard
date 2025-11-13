// CRIAR E ATIVAR O HOTSPOT NO MIKROTIK AGORA!

import MikroNode from 'mikronode-ng2';

const conn = new MikroNode.Connection({
  host: '10.200.200.2',
  port: 8728,
  user: 'relay',
  password: 'api2025',
  timeout: 15000
});

console.log('🚀 CRIANDO HOTSPOT NO MIKROTIK\n');

async function main() {
  await conn.connect();
  console.log('✅ Conectado!\n');
  
  const chan = conn.openChannel();
  
  console.log('1️⃣  Criando/Ativando hotspot na interface bridge...\n');
  
  try {
    await chan.write('/ip/hotspot/add', [
      '=name=hotspot1',
      '=interface=bridge',
      '=address-pool=lan-pool',
      '=profile=hotspot-lopesul',
      '=keepalive-timeout=none',
      '=idle-timeout=5m'
    ]);
    console.log('✅ Hotspot criado!\n');
  } catch (e) {
    console.log('⚠️  Erro (pode já existir):', e.message);
    console.log('   Tentando habilitar...\n');
    
    try {
      await chan.write('/ip/hotspot/enable', ['=numbers=0']);
      console.log('✅ Hotspot habilitado!\n');
    } catch (e2) {
      console.log('❌ Erro:', e2.message, '\n');
    }
  }
  
  console.log('━'.repeat(60));
  console.log('✅ HOTSPOT DEVE ESTAR ATIVO AGORA!');
  console.log('━'.repeat(60));
  console.log('');
  console.log('🔄 PEÇA PARA O CLIENTE TESTAR AGORA:');
  console.log('   1. Desconectar do WiFi');
  console.log('   2. Reconectar');
  console.log('   3. Tentar acessar qualquer site');
  console.log('   4. AGORA SIM deve redirecionar!');
  console.log('━'.repeat(60));
  
  conn.close();
}

main().catch(e => { console.error(e); process.exit(1); });
