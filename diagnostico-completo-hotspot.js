// Diagnóstico COMPLETO do hotspot

import MikroNode from 'mikronode-ng2';

const conn = new MikroNode.Connection({
  host: '10.200.200.2',
  port: 8728,
  user: 'relay',
  password: 'api2025',
  timeout: 15000
});

console.log('🔍 DIAGNÓSTICO COMPLETO DO HOTSPOT\n');

async function main() {
  await conn.connect();
  console.log('✅ Conectado!\n');
  
  const chan = conn.openChannel();
  
  console.log('━'.repeat(60));
  console.log('1️⃣  VERIFICANDO INSTÂNCIAS DO HOTSPOT');
  console.log('━'.repeat(60));
  
  try {
    await chan.write('/ip/hotspot/print');
    console.log('✅ Hotspot ativo\n');
  } catch (e) {
    console.log('❌ Erro:', e.message, '\n');
  }
  
  console.log('━'.repeat(60));
  console.log('2️⃣  VERIFICANDO PERFIL hotspot-lopesul');
  console.log('━'.repeat(60));
  
  try {
    await chan.write('/ip/hotspot/profile/print');
    console.log('✅ Perfil configurado\n');
  } catch (e) {
    console.log('❌ Erro:', e.message, '\n');
  }
  
  console.log('━'.repeat(60));
  console.log('3️⃣  VERIFICANDO ARQUIVOS hotspot/');
  console.log('━'.repeat(60));
  
  try {
    await chan.write('/file/print');
    console.log('✅ Arquivos listados\n');
  } catch (e) {
    console.log('❌ Erro:', e.message, '\n');
  }
  
  console.log('━'.repeat(60));
  console.log('4️⃣  VERIFICANDO WALLED GARDEN');
  console.log('━'.repeat(60));
  
  try {
    await chan.write('/ip/hotspot/walled-garden/print');
    console.log('✅ Walled garden verificado\n');
  } catch (e) {
    console.log('❌ Erro:', e.message, '\n');
  }
  
  console.log('━'.repeat(60));
  console.log('5️⃣  VERIFICANDO USUÁRIOS ATIVOS');
  console.log('━'.repeat(60));
  
  try {
    await chan.write('/ip/hotspot/active/print');
    console.log('✅ Usuários ativos verificados\n');
  } catch (e) {
    console.log('❌ Erro:', e.message, '\n');
  }
  
  console.log('━'.repeat(60));
  console.log('🔍 POSSÍVEIS PROBLEMAS:');
  console.log('━'.repeat(60));
  console.log('1. O hotspot pode NÃO estar interceptando HTTP');
  console.log('2. O cliente pode já estar AUTENTICADO (tem cookie)');
  console.log('3. O perfil pode não estar usando os arquivos corretos');
  console.log('4. DNS redirect pode não estar funcionando');
  console.log('');
  console.log('💡 TESTE DEFINITIVO:');
  console.log('   Use um celular que NUNCA conectou nesse WiFi antes!');
  console.log('   Isso elimina qualquer cache/cookie/sessão anterior.');
  console.log('━'.repeat(60));
  
  conn.close();
}

main().catch(e => { console.error(e); process.exit(1); });
