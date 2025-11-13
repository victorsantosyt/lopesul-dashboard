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
  await chan.write('/file/set', ['=numbers=hotspot-login.html', '=name=hotspot/login.html']);
  console.log('✅ login.html movido para hotspot/login.html');
  conn.close();
}

main().catch(e => { console.error(e); process.exit(1); });
