#!/usr/bin/env node
// Script para verificar especificamente a regra 38
// Uso: node verificar-regra-38.js [mikId]

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

const RELAY_BASE = env.RELAY_URL || env.RELAY_BASE || 'http://localhost:4000';
const RELAY_TOKEN = env.RELAY_TOKEN || '';

async function execMikrotikCommand(host, user, pass, command) {
  try {
    if (!RELAY_TOKEN || RELAY_TOKEN.length < 10) {
      return { ok: false, error: 'RELAY_TOKEN ausente ou inválido no .env' };
    }

    const url = `${RELAY_BASE}/relay/exec`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RELAY_TOKEN}`,
      },
      body: JSON.stringify({
        host,
        user,
        pass,
        command,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `HTTP ${response.status}: ${text}` };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function main() {
  try {
    const mikIdOrIp = process.argv[2] || 'LOPESUL-HOTSPOT-06';
    
    console.log('🔍 Verificando regra 38 especificamente...');
    console.log(`   Roteador: ${mikIdOrIp}`);
    console.log('');

    // Buscar roteador
    let roteador = null;
    
    const dispositivo = await prisma.dispositivo.findFirst({
      where: {
        mikId: { equals: mikIdOrIp, mode: 'insensitive' },
      },
      include: {
        frota: {
          include: {
            roteador: true,
          },
        },
      },
    });

    if (dispositivo?.frota?.roteador) {
      roteador = dispositivo.frota.roteador;
    } else {
      roteador = await prisma.roteador.findFirst({
        where: {
          OR: [
            { ipLan: mikIdOrIp },
            { nome: { contains: mikIdOrIp, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (!roteador) {
      console.log('❌ Roteador não encontrado!');
      return;
    }

    const host = roteador.ipLan;
    const user = roteador.usuario || 'relay';
    const pass = env.MIKROTIK_PASS || '';

    if (!pass) {
      console.error('❌ MIKROTIK_PASS não configurado no .env');
      return;
    }

    console.log(`✅ Roteador: ${roteador.nome} (${host})`);
    console.log('');

    // Buscar regra 38 especificamente
    const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print where chain=forward');
    if (!filterRules.ok) {
      console.log(`❌ Erro ao buscar regras: ${filterRules.error}`);
      return;
    }

    const regras = filterRules.data || [];
    
    // Ordenar por ID
    regras.sort((a, b) => {
      const idA = parseInt(a['.id'] || '0', 16);
      const idB = parseInt(b['.id'] || '0', 16);
      return idA - idB;
    });

    // Encontrar regra que bloqueia 192.168.88.0/24
    const regra38 = regras.find(r => 
      r['src-address'] === '192.168.88.0/24' &&
      (r.action === 'drop' || r.action === 'reject')
    );

    if (!regra38) {
      console.log('✅ Nenhuma regra bloqueando 192.168.88.0/24 encontrada!');
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 REGRA QUE BLOQUEIA 192.168.88.0/24:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ID: ${regra38['.id']}`);
    console.log(`   Action: ${regra38.action}`);
    console.log(`   Src Address: ${regra38['src-address']}`);
    console.log(`   Src Address List: ${regra38['src-address-list'] || 'N/A'}`);
    console.log(`   Comentário: ${regra38.comment || 'N/A'}`);
    console.log(`   Desabilitado: ${regra38.disabled === 'true' ? 'Sim ⚠️' : 'Não ✅'}`);
    console.log('');

    // Verificar se tem exceção para paid_clients
    const temExcecao = regra38['src-address-list'] === '!paid_clients' || 
                       (regra38['src-address-list'] && regra38['src-address-list'].includes('!paid_clients'));

    if (temExcecao) {
      console.log('✅ Regra TEM exceção para paid_clients (!paid_clients)');
      console.log('');
      console.log('💡 Se ainda não funciona, pode ser:');
      console.log('   1. A sintaxe do Mikrotik não aceita src-address E src-address-list juntos');
      console.log('   2. Precisa remover src-address e usar apenas src-address-list');
      console.log('   3. Ou criar regra de permitir ANTES desta regra');
    } else {
      console.log('❌ PROBLEMA: Regra NÃO tem exceção para paid_clients!');
      console.log('');
      console.log('💡 Precisa adicionar src-address-list=!paid_clients');
      console.log(`   Comando: /ip/firewall/filter/set .id=${regra38['.id']} src-address-list=!paid_clients`);
    }
    console.log('');

    // Verificar posição da regra
    const posicao = regras.indexOf(regra38);
    const regraPaidClients = regras.find(r => 
      r['src-address-list'] === 'paid_clients' && r.action === 'accept'
    );
    
    if (regraPaidClients) {
      const posicaoPaid = regras.indexOf(regraPaidClients);
      console.log(`📊 Posição da regra paid_clients: ${posicaoPaid + 1}`);
      console.log(`📊 Posição da regra de bloqueio: ${posicao + 1}`);
      
      if (posicaoPaid < posicao) {
        console.log('✅ Regra paid_clients está ANTES da regra de bloqueio (correto)');
      } else {
        console.log('❌ PROBLEMA: Regra de bloqueio está ANTES da regra paid_clients!');
        console.log('   Precisa mover a regra paid_clients para antes da regra de bloqueio');
      }
    }
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

