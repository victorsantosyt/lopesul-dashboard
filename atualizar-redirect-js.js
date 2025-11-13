import MikroNode from 'mikronode-ng2';

const conn = new MikroNode.Connection({
  host: '10.200.200.2',
  port: 8728,
  user: 'relay',
  password: 'api2025',
  timeout: 10000
});

async function main() {
  await conn.connect();
  const chan = conn.openChannel();
  
  console.log('🔄 Atualizando arquivos do hotspot...\n');
  
  try {
    await chan.write('/file/remove', ['=[find name="hotspot/redirect.html"]']);
    console.log('✅ redirect.html antigo removido');
  } catch {}
  
  try {
    await chan.write('/file/remove', ['=[find name="hotspot/login.html"]']);
    console.log('✅ login.html antigo removido');
  } catch {}
  
  await chan.write('/file/set', ['=numbers=redirect-new.html', '=name=hotspot/redirect.html']);
  console.log('✅ redirect.html criado com JavaScript!\n');
  
  // Copiar para login.html também
  await chan.write('/file/set', ['=numbers=hotspot/redirect.html', '=name=hotspot/login.html']);
  console.log('✅ login.html criado!\n');
  
  console.log('━'.repeat(60));
  console.log('✅ ARQUIVOS ATUALIZADOS COM JAVASCRIPT!');
  console.log('━'.repeat(60));
  console.log('Agora as variáveis MikroTik serão processadas corretamente.');
  console.log('\n🔄 Peça para o cliente testar novamente!');
  
  conn.close();
}

main().catch(e => { console.error(e); process.exit(1); });
