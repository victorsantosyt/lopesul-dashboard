#!/usr/bin/env node
// Script para verificar a ordem das regras de firewall e identificar bloqueios
// Uso: node verificar-ordem-firewall-cliente.js <IP> [mikId]

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
  if (!RELAY_TOKEN) {
    return { ok: false, error: 'RELAY_TOKEN ausente' };
  }
  try {
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

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${data.error || response.statusText}` };
    }
    return data;
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function ipMatches(ip, pattern) {
  if (!pattern) return false;
  if (pattern === ip) return true;
  if (pattern.includes('/')) {
    // CIDR notation
    const [network, prefix] = pattern.split('/');
    const prefixLen = parseInt(prefix, 10);
    const ipParts = ip.split('.').map(Number);
    const netParts = network.split('.').map(Number);
    const mask = (0xFFFFFFFF << (32 - prefixLen)) >>> 0;
    const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    const netNum = (netParts[0] << 24) + (netParts[1] << 16) + (netParts[2] << 8) + netParts[3];
    return (ipNum & mask) === (netNum & mask);
  }
  return ip.startsWith(pattern.split('.')[0] + '.');
}

async function main() {
  try {
    const IP = process.argv[2];
    const MIK_ID = process.argv[3] || null;
    
    if (!IP) {
      console.log('📋 Uso: node verificar-ordem-firewall-cliente.js <IP> [mikId]');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node verificar-ordem-firewall-cliente.js 192.168.88.82');
      console.log('   node verificar-ordem-firewall-cliente.js 192.168.88.82 LOPESUL-HOTSPOT-06');
      process.exit(1);
    }

    console.log('🔍 Verificando ordem das regras de firewall...');
    console.log(`   IP: ${IP}`);
    if (MIK_ID) console.log(`   MikId: ${MIK_ID}`);
    console.log('');

    // Buscar roteador
    let roteador = null;
    
    if (MIK_ID) {
      const dispositivo = await prisma.dispositivo.findUnique({
        where: { mikId: MIK_ID },
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
      }
    } else {
      const sessao = await prisma.sessaoAtiva.findFirst({
        where: { ipCliente: IP },
        include: { roteador: true },
        orderBy: { inicioEm: 'desc' },
      });
      
      if (sessao?.roteador) {
        roteador = sessao.roteador;
      }
    }

    if (!roteador) {
      console.log('❌ Roteador não encontrado!');
      return;
    }

    const host = roteador.ipLan;
    const user = roteador.usuario;
    const pass = roteador.senhaHash;

    console.log(`✅ Roteador: ${roteador.nome} (${host})`);
    console.log('');

    // Buscar todas as regras de firewall na chain forward
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 REGRAS DE FIREWALL (CHAIN: FORWARD)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print');
    if (filterRules.ok && Array.isArray(filterRules.data)) {
      // Filtrar apenas regras da chain forward
      const forwardRules = filterRules.data
        .filter(r => r.chain === 'forward')
        .map((r, idx) => ({ ...r, position: idx + 1 }))
        .sort((a, b) => {
          // Ordenar por .id (ordem de execução no Mikrotik)
          const aId = parseInt(a['.id']?.replace('*', '') || '0', 16);
          const bId = parseInt(b['.id']?.replace('*', '') || '0', 16);
          return aId - bId;
        });

      console.log(`Total de regras na chain forward: ${forwardRules.length}`);
      console.log('');

      // Encontrar a regra paid_clients
      const paidRuleIndex = forwardRules.findIndex(r => 
        r['src-address-list'] && r['src-address-list'].includes('paid_clients')
      );

      if (paidRuleIndex >= 0) {
        const paidRule = forwardRules[paidRuleIndex];
        console.log(`✅ Regra paid_clients encontrada na posição ${paidRuleIndex + 1}:`);
        console.log(`   ID: ${paidRule['.id'] || 'N/A'}`);
        console.log(`   Action: ${paidRule.action || 'N/A'}`);
        console.log(`   Src Address List: ${paidRule['src-address-list'] || 'N/A'}`);
        console.log('');
      } else {
        console.log('❌ Regra paid_clients NÃO encontrada!');
        console.log('');
      }

      // Verificar regras que podem bloquear ANTES da regra paid_clients
      if (paidRuleIndex > 0) {
        console.log('🔍 Verificando regras ANTES da regra paid_clients...');
        console.log('');
        
        const rulesBefore = forwardRules.slice(0, paidRuleIndex);
        const blockingRules = rulesBefore.filter(r => 
          (r.action === 'drop' || r.action === 'reject') &&
          (
            ipMatches(IP, r['src-address']) ||
            (r['src-address'] && IP.startsWith(r['src-address'].split('/')[0])) ||
            (r['src-address-list'] && !r['src-address-list'].includes('paid_clients') && !r['src-address-list'].startsWith('!'))
          )
        );

        if (blockingRules.length > 0) {
          console.log(`⚠️  ${blockingRules.length} regra(s) que podem bloquear ANTES da regra paid_clients:`);
          blockingRules.forEach((r, idx) => {
            console.log(`   ${idx + 1}. ID: ${r['.id'] || 'N/A'}`);
            console.log(`      Action: ${r.action}`);
            console.log(`      Src Address: ${r['src-address'] || 'N/A'}`);
            console.log(`      Src Address List: ${r['src-address-list'] || 'N/A'}`);
            console.log(`      Comentário: ${r.comment || 'N/A'}`);
            console.log('');
          });
          console.log('💡 PROBLEMA: Essas regras podem estar bloqueando o cliente antes da regra paid_clients!');
          console.log('   Solução: Mover a regra paid_clients para o início ou ajustar essas regras');
        } else {
          console.log('✅ Nenhuma regra bloqueando antes da regra paid_clients');
        }
        console.log('');
      }

      // Listar as primeiras 10 regras para referência
      console.log('📋 Primeiras 10 regras da chain forward:');
      forwardRules.slice(0, 10).forEach((r, idx) => {
        const isPaid = r['src-address-list'] && r['src-address-list'].includes('paid_clients');
        const marker = isPaid ? '⭐' : (r.action === 'drop' || r.action === 'reject') ? '🚫' : '  ';
        console.log(`   ${marker} ${idx + 1}. ID: ${r['.id'] || 'N/A'}, Action: ${r.action || 'N/A'}, Src: ${r['src-address'] || r['src-address-list'] || 'N/A'}`);
      });
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 RECOMENDAÇÕES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Se a regra paid_clients não está no início:');
    console.log('   1. Mova a regra paid_clients para a primeira posição');
    console.log('   2. Ou ajuste as regras bloqueadoras para excluir paid_clients');
    console.log('');
    console.log('Se tudo está correto mas o cliente não tem acesso:');
    console.log('   1. Peça para o cliente fazer uma nova requisição HTTP');
    console.log('   2. Verifique se o cliente está conectado ao Wi-Fi correto');
    console.log('   3. Verifique logs do Mikrotik para erros');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

