#!/usr/bin/env node
// Script simples para liberar acesso via API REST
// Uso: node liberar-cliente-simples.js <IP> <MAC> [pedidoCode]

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('❌ Uso: node liberar-cliente-simples.js <IP> <MAC> [pedidoCode]');
  console.log('');
  console.log('Exemplo:');
  console.log('  node liberar-cliente-simples.js 192.168.88.68 24:29:34:91:1A:18');
  console.log('  node liberar-cliente-simples.js 192.168.88.68 24:29:34:91:1A:18 KPN2TGTO8Z');
  process.exit(1);
}

const ip = args[0];
const mac = args[1];
const pedidoCode = args[2] || null;

console.log('🔓 Liberando acesso via API...');
console.log(`   IP: ${ip}`);
console.log(`   MAC: ${mac}`);
if (pedidoCode) {
  console.log(`   Pedido: ${pedidoCode}`);
}
console.log('');

async function liberar() {
  try {
    const url = 'http://localhost:3000/api/liberar-acesso';
    const body = {
      ip,
      mac,
    };

    if (pedidoCode) {
      body.externalId = pedidoCode;
    }

    console.log('📡 Chamando API...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      console.log('✅ Acesso liberado com sucesso!');
      console.log(`   Pedido ID: ${data.pedidoId || 'N/A'}`);
      if (data.mikrotik) {
        console.log(`   Mikrotik: ${JSON.stringify(data.mikrotik)}`);
      }
    } else {
      console.error('❌ Erro ao liberar acesso:');
      console.error('   Status:', response.status);
      console.error('   Erro:', data.error || data.message || JSON.stringify(data));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.message.includes('fetch')) {
      console.error('💡 Certifique-se de que o servidor está rodando (pm2 list)');
    }
    process.exit(1);
  }
}

liberar();

