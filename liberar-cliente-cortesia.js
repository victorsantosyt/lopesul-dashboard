#!/usr/bin/env node
/**
 * Script para liberar acesso de cortesia (cria pedido temporário)
 * 
 * Uso:
 *   node liberar-cliente-cortesia.js <IP> <MAC> [duracao] [deviceId] [mikId]
 * 
 * Exemplo:
 *   node liberar-cliente-cortesia.js 192.168.88.65 1A:A0:2A:08:C7:12
 *   node liberar-cliente-cortesia.js 192.168.88.65 1A:A0:2A:08:C7:12 24h
 *   node liberar-cliente-cortesia.js 192.168.88.65 1A:A0:2A:08:C7:12 12h cmi3x1jtv000xl3s1u9svk22n LOPESUL-HOTSPOT-06
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

const IP = process.argv[2];
const MAC = process.argv[3];
const DURACAO = process.argv[4] || '2h'; // 12h, 24h, 48h ou 2h (padrão)
const DEVICE_ID = process.argv[5] || null;
const MIK_ID = process.argv[6] || null;

if (!IP || !MAC) {
  console.log('❌ Erro: Informe IP e MAC');
  console.log('');
  console.log('Uso:');
  console.log('   node liberar-cliente-cortesia.js <IP> <MAC> [duracao] [deviceId] [mikId]');
  console.log('');
  console.log('Parâmetros:');
  console.log('   IP        - IP do cliente (ex: 192.168.88.65)');
  console.log('   MAC       - MAC do cliente (ex: 1A:A0:2A:08:C7:12)');
  console.log('   duracao   - Duração do acesso: 12h, 24h, 48h ou 2h (padrão)');
  console.log('   deviceId  - ID do dispositivo (opcional)');
  console.log('   mikId     - ID do Mikrotik (opcional)');
  console.log('');
  console.log('Exemplo:');
  console.log('   node liberar-cliente-cortesia.js 192.168.88.65 1A:A0:2A:08:C7:12');
  console.log('   node liberar-cliente-cortesia.js 192.168.88.65 1A:A0:2A:08:C7:12 24h');
  console.log('   node liberar-cliente-cortesia.js 192.168.88.65 1A:A0:2A:08:C7:12 12h cmi3x1jtv000xl3s1u9svk22n LOPESUL-HOTSPOT-06');
  process.exit(1);
}

// Normalizar duração para descrição do pedido
function normalizarDuracao(duracao) {
  const d = String(duracao).toLowerCase().trim();
  if (d === '12h' || d === '12') return 'Acesso 12h';
  if (d === '24h' || d === '24') return 'Acesso 24h';
  if (d === '48h' || d === '48') return 'Acesso 48h';
  if (d === '2h' || d === '2') return 'Acesso 2h';
  // Se não reconheceu, usar como está (pode ser "Acesso 12h" já formatado)
  if (d.includes('acesso')) return d.charAt(0).toUpperCase() + d.slice(1);
  return `Acesso ${d}`;
}

async function main() {
  try {
    const descricao = normalizarDuracao(DURACAO);
    
    console.log('🔓 Liberando acesso de cortesia...');
    console.log(`   IP: ${IP}`);
    console.log(`   MAC: ${MAC}`);
    console.log(`   Duração: ${descricao}`);
    if (DEVICE_ID) console.log(`   DeviceId: ${DEVICE_ID}`);
    if (MIK_ID) console.log(`   MikId: ${MIK_ID}`);
    console.log('');

    // Criar pedido temporário de cortesia
    const pedidoCode = `CORTESIA-${Date.now()}`;
    console.log('📝 Criando pedido temporário de cortesia...');
    
    // Buscar dispositivo se deviceId/mikId fornecido, ou tentar encontrar pelo IP
    let deviceIdFinal = DEVICE_ID;
    let mikIdFinal = MIK_ID;
    
    if (!deviceIdFinal && MIK_ID) {
      const device = await prisma.dispositivo.findUnique({
        where: { mikId: MIK_ID },
        select: { id: true, mikId: true },
      });
      if (device) {
        deviceIdFinal = device.id;
        mikIdFinal = device.mikId;
        console.log(`   ✅ Dispositivo encontrado: ${deviceIdFinal} (${mikIdFinal})`);
      }
    }
    
    // Se não encontrou, tentar buscar pelo IP (subnet)
    if (!deviceIdFinal && IP) {
      const subnet = IP.substring(0, IP.lastIndexOf('.'));
      const devices = await prisma.dispositivo.findMany({
        where: {
          OR: [
            { ip: { startsWith: subnet } },
            { mikrotikHost: { startsWith: subnet } },
          ],
        },
        select: { id: true, mikId: true, ip: true },
      });
      
      if (devices.length === 1) {
        deviceIdFinal = devices[0].id;
        mikIdFinal = devices[0].mikId;
        console.log(`   ✅ Dispositivo encontrado pelo IP (subnet ${subnet}): ${deviceIdFinal} (${mikIdFinal})`);
      } else if (devices.length > 1) {
        // Escolher o que tem mikrotikHost correspondente
        const deviceByHost = devices.find(d => d.mikrotikHost && d.mikrotikHost.startsWith(subnet));
        if (deviceByHost) {
          deviceIdFinal = deviceByHost.id;
          mikIdFinal = deviceByHost.mikId;
          console.log(`   ✅ Dispositivo escolhido entre múltiplos: ${deviceIdFinal} (${mikIdFinal})`);
        } else {
          deviceIdFinal = devices[0].id;
          mikIdFinal = devices[0].mikId;
          console.log(`   ✅ Dispositivo escolhido (primeiro): ${deviceIdFinal} (${mikIdFinal})`);
        }
      }
    }

    const pedido = await prisma.pedido.create({
      data: {
        code: pedidoCode,
        status: 'PAID',
        amount: 0, // Cortesia = R$ 0,00
        method: 'PIX', // Método de pagamento (obrigatório)
        description: descricao, // Usar descrição com duração (ex: "Acesso 24h")
        ip: IP,
        deviceMac: MAC,
        deviceId: deviceIdFinal,
        metadata: {
          cortesia: true,
          motivo: 'Acesso liberado manualmente',
          duracao: DURACAO,
        },
      },
    });

    console.log(`   ✅ Pedido criado: ${pedidoCode} (ID: ${pedido.id})`);
    console.log('');

    // Agora liberar acesso usando o pedido criado
    const body = {
      externalId: pedidoCode,
      ip: IP,
      mac: MAC,
    };

    // Sempre passar deviceId/mikId se encontrados
    if (deviceIdFinal) body.deviceId = deviceIdFinal;
    if (mikIdFinal) body.mikId = mikIdFinal;
    
    if (!deviceIdFinal && !mikIdFinal) {
      console.log('   ⚠️  Aviso: Dispositivo não encontrado. Tentando liberar sem deviceId/mikId...');
    }

    console.log('📡 Chamando API /api/liberar-acesso...');
    const response = await fetch('http://localhost:3000/api/liberar-acesso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Erro:', data.error || `HTTP ${response.status}`);
      // Deletar pedido criado em caso de erro
      await prisma.pedido.delete({ where: { id: pedido.id } }).catch(() => {});
      process.exit(1);
    }

    if (data.ok) {
      console.log('✅ Acesso liberado com sucesso!');
      console.log('');
      console.log('📋 Detalhes:');
      console.log(`   Pedido: ${pedidoCode}`);
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
      // Deletar pedido criado em caso de erro
      await prisma.pedido.delete({ where: { id: pedido.id } }).catch(() => {});
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

