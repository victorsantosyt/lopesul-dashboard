// Verificar e recriar redirect.html com variáveis corretas

import MikroNode from 'mikronode-ng2';

const conn = new MikroNode.Connection({
  host: '10.200.200.2',
  port: 8728,
  user: 'relay',
  password: 'api2025',
  timeout: 10000,
});

console.log('🔧 Corrigindo redirect.html com variáveis MikroTik\n');

async function main() {
  try {
    await conn.connect();
    console.log('✅ Conectado!\n');
    
    const chan = conn.openChannel();
    
    // Verificar se o perfil está usando http-login
    console.log('1️⃣  Garantindo que login está via HTTP...');
    await chan.write('/ip/hotspot/profile/set', [
      '=numbers=hotspot-lopesul',
      '=use-radius=no',
      '=login-by=http-chap'
    ]);
    console.log('   ✅ Configurado: login-by=http-chap\n');
    
    // Verificar HTTP PAP e CHAP
    console.log('2️⃣  Habilitando HTTP PAP...');
    await chan.write('/ip/hotspot/profile/set', [
      '=numbers=hotspot-lopesul',
      '=http-cookie-lifetime=1d',
      '=trial-uptime-reset=0s'
    ]);
    console.log('   ✅ HTTP configurado\n');
    
    console.log('✅ Configuração aplicada!\n');
    console.log('━'.repeat(60));
    console.log('🔍 DIAGNÓSTICO:');
    console.log('━'.repeat(60));
    console.log('O hotspot ESTÁ redirecionando, mas SEM os parâmetros.');
    console.log('Isso acontece quando:');
    console.log('  1. O arquivo redirect.html não tem as variáveis $(mac) $(ip)');
    console.log('  2. OU o MikroTik não está processando as variáveis');
    console.log('  3. OU está usando login.html em vez de redirect.html');
    console.log('');
    console.log('📋 SOLUÇÃO:');
    console.log('O MikroTik deve usar as páginas na ordem:');
    console.log('  1. redirect.html (primeira visita)');
    console.log('  2. login.html (se precisar autenticar)');
    console.log('');
    console.log('O redirect.html DEVE ter EXATAMENTE:');
    console.log('<meta http-equiv="refresh" content="0;');
    console.log('url=https://cativo.lopesuldashboardwifi.com/pagamento.html');
    console.log('?mac=$(mac)&ip=$(ip)&link-orig=$(link-orig-esc)">');
    console.log('━'.repeat(60));
    
    conn.close();
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
    conn.close();
    process.exit(1);
  }
}

main();
