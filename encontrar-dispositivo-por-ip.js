#!/usr/bin/env node
// Script para encontrar dispositivo/Mikrotik pelo IP do cliente
// Uso: node encontrar-dispositivo-por-ip.js <IP>

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env
const envPath = join(__dirname, '.env');
let envContent = '';
try {
  envContent = readFileSync(envPath, 'utf-8');
} catch (e) {
  console.error('❌ Erro ao ler .env:', e.message);
  process.exit(1);
}

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    env[key] = value;
  }
});

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
});

async function main() {
  try {
    const ipCliente = process.argv[2];
    
    if (!ipCliente) {
      console.log('📋 Uso: node encontrar-dispositivo-por-ip.js <IP>');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node encontrar-dispositivo-por-ip.js 192.168.88.82');
      process.exit(1);
    }

    console.log('🔍 Buscando dispositivo/Mikrotik para IP:', ipCliente);
    console.log('');

    // Extrair subnet do IP (ex: 192.168.88.82 -> 192.168.88)
    const subnet = ipCliente.substring(0, ipCliente.lastIndexOf('.'));
    console.log(`📡 Subnet: ${subnet}.x`);
    console.log('');

    // Buscar dispositivos pela subnet
    const dispositivos = await prisma.dispositivo.findMany({
      where: {
        OR: [
          { ip: { startsWith: subnet } },
          { mikrotikHost: { startsWith: subnet } },
        ],
      },
      include: {
        frota: {
          include: {
            roteador: {
              select: {
                id: true,
                nome: true,
                ipLan: true,
                usuario: true,
              },
            },
          },
        },
      },
    });

    if (dispositivos.length === 0) {
      console.log('❌ Nenhum dispositivo encontrado para esta subnet.');
      console.log('');
      console.log('💡 Tentando buscar todos os dispositivos disponíveis...');
      console.log('');
      
      // Listar todos os dispositivos
      const todosDispositivos = await prisma.dispositivo.findMany({
        select: {
          id: true,
          mikId: true,
          ip: true,
          mikrotikHost: true,
        },
        take: 20,
      });

      if (todosDispositivos.length > 0) {
        console.log(`📋 ${todosDispositivos.length} dispositivo(s) encontrado(s):`);
        todosDispositivos.forEach((d, idx) => {
          console.log(`   ${idx + 1}. mikId: ${d.mikId || 'N/A'}`);
          console.log(`      IP: ${d.ip || 'N/A'}`);
          console.log(`      Mikrotik Host: ${d.mikrotikHost || 'N/A'}`);
          console.log(`      DeviceId: ${d.id}`);
          console.log('');
        });
        console.log('💡 Use um dos mikId acima no comando:');
        console.log(`   node liberar-cliente-cortesia.js ${ipCliente} <MAC> 24h "" <mikId>`);
      } else {
        console.log('❌ Nenhum dispositivo cadastrado no sistema.');
      }
      return;
    }

    console.log(`✅ ${dispositivos.length} dispositivo(s) encontrado(s):`);
    console.log('');

    for (const dispositivo of dispositivos) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📱 Dispositivo: ${dispositivo.mikId || 'N/A'}`);
      console.log(`   DeviceId: ${dispositivo.id}`);
      console.log(`   IP: ${dispositivo.ip || 'N/A'}`);
      console.log(`   Mikrotik Host: ${dispositivo.mikrotikHost || 'N/A'}`);
      
      if (dispositivo.frota?.roteador) {
        const roteador = dispositivo.frota.roteador;
        console.log(`   Roteador: ${roteador.nome}`);
        console.log(`   IP Roteador: ${roteador.ipLan}`);
        console.log(`   Usuário: ${roteador.usuario}`);
      }
      console.log('');
    }

    // Recomendar o primeiro dispositivo encontrado
    const recomendado = dispositivos[0];
    console.log('💡 Comando recomendado:');
    console.log(`   node liberar-cliente-cortesia.js ${ipCliente} <MAC> 24h "${recomendado.id}" "${recomendado.mikId || ''}"`);
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

