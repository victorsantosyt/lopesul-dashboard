#!/usr/bin/env node
/**
 * Script para liberar acesso de cortesia (sem criar pedido)
 * 
 * Uso:
 *   node liberar-cliente-cortesia.js <IP> <MAC> [deviceId] [mikId]
 * 
 * Exemplo:
 *   node liberar-cliente-cortesia.js 192.168.88.65 1A:A0:2A:08:C7:12
 */

import fetch from 'node-fetch';

const IP = process.argv[2];
const MAC = process.argv[3];
const DEVICE_ID = process.argv[4] || null;
const MIK_ID = process.argv[5] || null;

if (!IP || !MAC) {
  console.log('❌ Erro: Informe IP e MAC');
  console.log('');
  console.log('Uso:');
  console.log('   node liberar-cliente-cortesia.js <IP> <MAC> [deviceId] [mikId]');
  console.log('');
  console.log('Exemplo:');
  console.log('   node liberar-cliente-cortesia.js 192.168.88.65 1A:A0:2A:08:C7:12');
  console.log('   node liberar-cliente-cortesia.js 192.168.88.65 1A:A0:2A:08:C7:12 cmi3x1jtv000xl3s1u9svk22n LOPESUL-HOTSPOT-06');
  process.exit(1);
}

async function main() {
  try {
    console.log('🔓 Liberando acesso de cortesia...');
    console.log(`   IP: ${IP}`);
    console.log(`   MAC: ${MAC}`);
    if (DEVICE_ID) console.log(`   DeviceId: ${DEVICE_ID}`);
    if (MIK_ID) console.log(`   MikId: ${MIK_ID}`);
    console.log('');

    const body = {
      externalId: `cortesia-${Date.now()}`,
      ip: IP,
      mac: MAC,
    };

    if (DEVICE_ID) body.deviceId = DEVICE_ID;
    if (MIK_ID) body.mikId = MIK_ID;

    console.log('📡 Chamando API /api/liberar-acesso...');
    const response = await fetch('http://localhost:3000/api/liberar-acesso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Erro:', data.error || `HTTP ${response.status}`);
      process.exit(1);
    }

    if (data.ok) {
      console.log('✅ Acesso liberado com sucesso!');
      console.log('');
      console.log('📋 Detalhes:');
      if (data.mikrotik) {
        console.log(`   Mikrotik: ${data.mikrotik.via || 'N/A'}`);
        if (data.mikrotik.cmds) {
          console.log(`   Comandos executados: ${data.mikrotik.cmds.length}`);
        }
      }
      console.log('');
      console.log('💡 O cliente deve conseguir acessar a internet agora.');
      console.log('   Se não funcionar, peça para o cliente fazer uma nova requisição HTTP.');
    } else {
      console.error('❌ Falha ao liberar acesso:', data);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

main();

