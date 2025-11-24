#!/usr/bin/env node
// Script para diagnosticar cliente que foi liberado mas não tem acesso
// Uso: node diagnosticar-cliente-sem-acesso.js <IP> [MAC] [mikId]

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
    console.error('❌ RELAY_TOKEN não configurado no .env');
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

async function main() {
  try {
    const IP = process.argv[2];
    const MAC = process.argv[3] || null;
    const MIK_ID = process.argv[4] || null;
    
    if (!IP) {
      console.log('📋 Uso: node diagnosticar-cliente-sem-acesso.js <IP> [MAC] [mikId]');
      console.log('');
      console.log('💡 Exemplo:');
      console.log('   node diagnosticar-cliente-sem-acesso.js 192.168.88.82');
      console.log('   node diagnosticar-cliente-sem-acesso.js 192.168.88.82 4A:CE:1D:DC:36:E3');
      console.log('   node diagnosticar-cliente-sem-acesso.js 192.168.88.82 4A:CE:1D:DC:36:E3 LOPESUL-HOTSPOT-06');
      process.exit(1);
    }

    console.log('🔍 Diagnosticando cliente sem acesso...');
    console.log(`   IP: ${IP}`);
    if (MAC) console.log(`   MAC: ${MAC}`);
    if (MIK_ID) console.log(`   MikId: ${MIK_ID}`);
    console.log('');

    // 1. Verificar sessão no banco
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ VERIFICANDO SESSÃO NO BANCO DE DADOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let sessao = await prisma.sessaoAtiva.findFirst({
      where: {
        ipCliente: IP,
        ...(MAC ? { macCliente: MAC } : {}),
      },
      include: {
        pedido: {
          select: {
            id: true,
            code: true,
            status: true,
            description: true,
            amount: true,
            createdAt: true,
          },
        },
        roteador: {
          select: {
            nome: true,
            ipLan: true,
            usuario: true,
          },
        },
      },
      orderBy: { inicioEm: 'desc' },
    });

    if (!sessao && MAC) {
      // Tentar buscar apenas por IP
      sessao = await prisma.sessaoAtiva.findFirst({
        where: {
          ipCliente: IP,
        },
        include: {
          pedido: {
            select: {
              id: true,
              code: true,
              status: true,
              description: true,
              amount: true,
              createdAt: true,
            },
          },
          roteador: {
            select: {
              nome: true,
              ipLan: true,
              usuario: true,
            },
          },
        },
        orderBy: { inicioEm: 'desc' },
      });
    }

    if (sessao) {
      const agora = new Date();
      const expirada = sessao.expiraEm < agora;
      const ativa = sessao.ativo && !expirada;
      
      console.log('✅ Sessão encontrada:');
      console.log(`   ID: ${sessao.id}`);
      console.log(`   IP: ${sessao.ipCliente}`);
      console.log(`   MAC: ${sessao.macCliente || 'N/A'}`);
      console.log(`   Plano: ${sessao.plano || 'N/A'}`);
      console.log(`   Início: ${sessao.inicioEm.toISOString()}`);
      console.log(`   Expira: ${sessao.expiraEm.toISOString()}`);
      console.log(`   Ativo (banco): ${sessao.ativo ? 'Sim' : 'Não'}`);
      console.log(`   Status: ${ativa ? '✅ ATIVA' : expirada ? '⏰ EXPIRADA' : '❌ INATIVA'}`);
      
      if (sessao.pedido) {
        console.log(`   Pedido: ${sessao.pedido.code} (${sessao.pedido.status})`);
      }
      
      if (sessao.roteador) {
        console.log(`   Roteador: ${sessao.roteador.nome} (${sessao.roteador.ipLan})`);
      }
    } else {
      console.log('❌ Nenhuma sessão encontrada no banco de dados!');
    }
    console.log('');

    // 2. Buscar dispositivo/Mikrotik
    let dispositivo = null;
    let roteador = null;
    
    if (MIK_ID) {
      dispositivo = await prisma.dispositivo.findUnique({
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
    } else if (sessao?.roteador) {
      roteador = sessao.roteador;
    } else {
      // Tentar encontrar pelo IP (subnet)
      const subnet = IP.substring(0, IP.lastIndexOf('.'));
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
              roteador: true,
            },
          },
        },
        take: 1,
      });
      
      if (dispositivos.length > 0 && dispositivos[0].frota?.roteador) {
        dispositivo = dispositivos[0];
        roteador = dispositivos[0].frota.roteador;
      }
    }

    if (!roteador) {
      console.log('❌ Roteador não encontrado! Não é possível verificar no Mikrotik.');
      console.log('   Use o parâmetro mikId para especificar o roteador.');
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ VERIFICANDO NO MIKROTIK');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Roteador: ${roteador.nome}`);
    console.log(`   IP: ${roteador.ipLan}`);
    console.log('');

    const host = roteador.ipLan;
    const user = roteador.usuario;
    const pass = roteador.senhaHash;

    // 2.1. Verificar paid_clients
    console.log('📋 2.1. Verificando paid_clients...');
    const paidClients = await execMikrotikCommand(host, user, pass, '/ip/firewall/address-list/print');
    if (paidClients.ok && Array.isArray(paidClients.data)) {
      const clientePaid = paidClients.data.find(c => c.address === IP && c.list === 'paid_clients');
      if (clientePaid) {
        console.log(`   ✅ Cliente está na lista paid_clients`);
        console.log(`      Comentário: ${clientePaid.comment || 'N/A'}`);
      } else {
        console.log(`   ❌ Cliente NÃO está na lista paid_clients!`);
      }
    } else {
      console.log(`   ⚠️  Erro ao buscar paid_clients: ${paidClients.error || 'Erro desconhecido'}`);
    }
    console.log('');

    // 2.2. Verificar ip-binding
    console.log('📋 2.2. Verificando ip-binding (bypassed)...');
    const ipBindings = await execMikrotikCommand(host, user, pass, '/ip/hotspot/ip-binding/print');
    if (ipBindings.ok && Array.isArray(ipBindings.data)) {
      const binding = ipBindings.data.find(b => 
        b.address === IP && 
        b.type === 'bypassed' &&
        (MAC ? b['mac-address'] === MAC : true)
      );
      if (binding) {
        console.log(`   ✅ IP binding existe (bypassed)`);
        console.log(`      MAC: ${binding['mac-address'] || 'N/A'}`);
        console.log(`      Comentário: ${binding.comment || 'N/A'}`);
      } else {
        console.log(`   ❌ IP binding NÃO existe!`);
        if (MAC) {
          console.log(`   💡 Tentando criar ip-binding...`);
          const createBinding = await execMikrotikCommand(host, user, pass, 
            `/ip/hotspot/ip-binding/add address=${IP} mac-address=${MAC} type=bypassed comment="CORRECAO-${Date.now()}"`
          );
          if (createBinding.ok) {
            console.log(`   ✅ IP binding criado com sucesso!`);
          } else {
            console.log(`   ❌ Erro ao criar ip-binding: ${createBinding.error}`);
          }
        }
      }
    } else {
      console.log(`   ⚠️  Erro ao buscar ip-binding: ${ipBindings.error || 'Erro desconhecido'}`);
    }
    console.log('');

    // 2.3. Verificar sessões ativas do hotspot
    console.log('📋 2.3. Verificando sessões ativas do hotspot...');
    const activeSessions = await execMikrotikCommand(host, user, pass, '/ip/hotspot/active/print');
    if (activeSessions.ok && Array.isArray(activeSessions.data)) {
      const sessaoAtiva = activeSessions.data.find(s => 
        s.address === IP || (MAC && s['mac-address'] === MAC)
      );
      if (sessaoAtiva) {
        console.log(`   ✅ Sessão ativa encontrada no hotspot`);
        console.log(`      IP: ${sessaoAtiva.address}`);
        console.log(`      MAC: ${sessaoAtiva['mac-address'] || 'N/A'}`);
        console.log(`      Usuário: ${sessaoAtiva.user || 'N/A'}`);
        console.log(`      Tempo: ${sessaoAtiva.uptime || 'N/A'}`);
      } else {
        console.log(`   ⚠️  Nenhuma sessão ativa encontrada no hotspot`);
        console.log(`   💡 O cliente precisa fazer uma nova requisição HTTP para ativar a sessão`);
      }
    } else {
      console.log(`   ⚠️  Erro ao buscar sessões ativas: ${activeSessions.error || 'Erro desconhecido'}`);
    }
    console.log('');

    // 3. Recomendações
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ RECOMENDAÇÕES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const problemas = [];
    
    if (!sessao) {
      problemas.push('❌ Não há sessão no banco de dados');
    } else if (!sessao.ativo || sessao.expiraEm < new Date()) {
      problemas.push('❌ Sessão está inativa ou expirada');
    }
    
    if (paidClients.ok && Array.isArray(paidClients.data)) {
      const clientePaid = paidClients.data.find(c => c.address === IP && c.list === 'paid_clients');
      if (!clientePaid) {
        problemas.push('❌ Cliente não está na lista paid_clients');
      }
    }
    
    if (ipBindings.ok && Array.isArray(ipBindings.data)) {
      const binding = ipBindings.data.find(b => 
        b.address === IP && 
        b.type === 'bypassed' &&
        (MAC ? b['mac-address'] === MAC : true)
      );
      if (!binding) {
        problemas.push('❌ IP binding (bypassed) não existe');
      }
    }
    
    if (problemas.length > 0) {
      console.log('🚨 Problemas encontrados:');
      problemas.forEach(p => console.log(`   ${p}`));
      console.log('');
      console.log('💡 Soluções:');
      console.log(`   1. Re-executar liberação: node liberar-cliente-cortesia.js ${IP} ${MAC || '<MAC>'} 48h "" ${roteador.nome || MIK_ID || '<mikId>'}`);
      console.log(`   2. Se o problema persistir, verificar firewall/NAT no Mikrotik`);
      console.log(`   3. Pedir para o cliente fazer uma nova requisição HTTP (abrir um site qualquer)`);
    } else {
      console.log('✅ Tudo parece estar configurado corretamente!');
      console.log('');
      console.log('💡 Se o cliente ainda não tem acesso:');
      console.log(`   1. Pedir para o cliente fazer uma nova requisição HTTP (abrir um site qualquer)`);
      console.log(`   2. Verificar se há regras de firewall bloqueando o tráfego`);
      console.log(`   3. Verificar se o NAT (masquerade) está configurado corretamente`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

