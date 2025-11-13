// Verificar a REALIDADE do hotspot - sem suposições

import MikroNode from 'mikronode-ng2';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const util = require('util');

const conn = new MikroNode.Connection({
  host: '10.200.200.2',
  port: 8728,
  user: 'relay',
  password: 'api2025',
  timeout: 15000
});

console.log('🔍 VERIFICAÇÃO DA REALIDADE - SEM SUPOSIÇÕES\n');

async function main() {
  await conn.connect();
  const chan = conn.openChannel();
  
  console.log('━'.repeat(70));
  console.log('1. QUAL HOTSPOT ESTÁ ATIVO?');
  console.log('━'.repeat(70));
  
  chan.write('/ip/hotspot/print', [], (err, data) => {
    if (data && data.length > 0) {
      data.forEach(hs => {
        console.log(util.inspect(hs, {depth: null, colors: false}));
      });
    } else {
      console.log('❌ NENHUM HOTSPOT ATIVO!');
    }
    console.log('');
    
    console.log('━'.repeat(70));
    console.log('2. QUAL PERFIL ESTÁ SENDO USADO?');
    console.log('━'.repeat(70));
    
    chan.write('/ip/hotspot/profile/print', [], (err, profiles) => {
      if (profiles && profiles.length > 0) {
        profiles.forEach(p => {
          console.log(util.inspect(p, {depth: null, colors: false}));
        });
      }
      console.log('');
      
      console.log('━'.repeat(70));
      console.log('3. O QUE TEM NO WALLED GARDEN?');
      console.log('━'.repeat(70));
      
      chan.write('/ip/hotspot/walled-garden/print', [], (err, walled) => {
        if (walled && walled.length > 0) {
          walled.forEach(w => {
            console.log(util.inspect(w, {depth: null, colors: false}));
          });
        } else {
          console.log('ℹ️  Walled garden vazio');
        }
        console.log('');
        
        console.log('━'.repeat(70));
        console.log('📊 CONCLUSÃO');
        console.log('━'.repeat(70));
        console.log('Veja os dados acima e identifique:');
        console.log('1. O hotspot está na interface correta?');
        console.log('2. O perfil tem html-directory=hotspot?');
        console.log('3. O walled garden NÃO tem cativo.lopesuldashboardwifi.com?');
        console.log('━'.repeat(70));
        
        conn.close();
      });
    });
  });
}

main().catch(e => { 
  console.error('❌ Erro:', e); 
  process.exit(1); 
});
