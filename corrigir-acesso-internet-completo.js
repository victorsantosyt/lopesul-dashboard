#!/usr/bin/env node
// Script para corrigir completamente o acesso à internet
// Uso: node corrigir-acesso-internet-completo.js [mikId] [--dry-run]

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
const DRY_RUN = process.argv.includes('--dry-run');

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
    
    console.log('🔧 Corrigindo acesso à internet completamente...');
    if (DRY_RUN) {
      console.log('⚠️  MODO DRY-RUN: Nenhuma alteração será feita');
    }
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

    // 1. Verificar e criar rota padrão se necessário
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ VERIFICANDO ROTA PADRÃO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const routes = await execMikrotikCommand(host, user, pass, '/ip/route/print');
    if (routes.ok && Array.isArray(routes.data)) {
      const defaultRoute = routes.data.find(r => 
        r['dst-address'] === '0.0.0.0/0' || r['dst-address'] === '0.0.0.0'
      );
      
      if (defaultRoute) {
        console.log(`   ✅ Rota padrão existe:`);
        console.log(`      Gateway: ${defaultRoute.gateway || 'N/A'}`);
        console.log(`      Interface: ${defaultRoute['interface'] || 'N/A'}`);
        if (defaultRoute.disabled === 'true') {
          console.log(`      ⚠️  Rota está DESABILITADA!`);
          if (!DRY_RUN) {
            const result = await execMikrotikCommand(
              host,
              user,
              pass,
              `/ip/route/enable .id=${defaultRoute['.id']}`
            );
            if (result.ok) {
              console.log(`      ✅ Rota habilitada!`);
            }
          }
        }
      } else {
        console.log('   ❌ Rota padrão NÃO existe!');
        console.log('   💡 Precisa criar rota padrão manualmente no Mikrotik');
        console.log('   Comando: /ip/route/add dst-address=0.0.0.0/0 gateway=<GATEWAY_IP>');
      }
    }
    console.log('');

    // 2. Verificar NAT masquerade para paid_clients
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ VERIFICANDO NAT MASQUERADE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const natRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/nat/print where chain=srcnat');
    if (natRules.ok && Array.isArray(natRules.data)) {
      const masquerade = natRules.data.filter(r => r.action === 'masquerade');
      
      // Verificar se há masquerade para 192.168.88.0/24 ou paid_clients
      const masqueradeHotspot = masquerade.find(r => 
        r['src-address'] === '192.168.88.0/24' ||
        r['src-address-list'] === 'paid_clients'
      );
      
      if (masqueradeHotspot) {
        console.log('   ✅ NAT masquerade para hotspot já existe');
      } else {
        // Verificar se há masquerade geral
        const masqueradeGeral = masquerade.find(r => !r['src-address']);
        if (masqueradeGeral) {
          console.log('   ✅ NAT masquerade geral existe (deve funcionar)');
        } else {
          console.log('   ⚠️  NAT masquerade pode não estar configurado corretamente');
        }
      }
    }
    console.log('');

    // 3. Verificar ordem das regras de firewall
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ VERIFICANDO ORDEM DAS REGRAS DE FIREWALL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print where chain=forward');
    if (filterRules.ok && Array.isArray(filterRules.data)) {
      // Ordenar por ID
      filterRules.data.sort((a, b) => {
        const idA = parseInt(a['.id'] || '0', 16);
        const idB = parseInt(b['.id'] || '0', 16);
        return idA - idB;
      });
      
      const regraPaidClients = filterRules.data.find(r => 
        r['src-address-list'] === 'paid_clients' && r.action === 'accept'
      );
      
      if (regraPaidClients) {
        const posicaoPaid = filterRules.data.indexOf(regraPaidClients);
        console.log(`   ✅ Regra paid_clients na posição ${posicaoPaid + 1}`);
        
        // Verificar se há regra de bloqueio antes
        const regrasBloqueioAntes = filterRules.data.slice(0, posicaoPaid).filter(r =>
          (r.action === 'drop' || r.action === 'reject') &&
          (r['src-address'] === '192.168.88.0/24' || !r['src-address'])
        );
        
        if (regrasBloqueioAntes.length > 0) {
          console.log(`   ⚠️  ${regrasBloqueioAntes.length} regra(s) de bloqueio ANTES da regra de permitir!`);
          console.log('   Isso pode estar bloqueando o tráfego.');
        } else {
          console.log('   ✅ Nenhuma regra de bloqueio antes da regra de permitir');
        }
      }
    }
    console.log('');

    // 4. Criar regra de firewall no início se necessário
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('4️⃣ GARANTINDO REGRA DE FIREWALL NO INÍCIO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (filterRules.ok && Array.isArray(filterRules.data)) {
      const regraPaidClients = filterRules.data.find(r => 
        r['src-address-list'] === 'paid_clients' && r.action === 'accept' && r.chain === 'forward'
      );
      
      if (!regraPaidClients) {
        console.log('   ❌ Regra paid_clients não existe!');
        if (!DRY_RUN) {
          const result = await execMikrotikCommand(
            host,
            user,
            pass,
            '/ip/firewall/filter/add chain=forward src-address-list=paid_clients action=accept comment="Liberar internet para clientes pagos" place-before=0'
          );
          if (result.ok) {
            console.log('   ✅ Regra criada no início!');
          } else {
            console.log(`   ❌ Erro ao criar regra: ${result.error}`);
          }
        } else {
          console.log('   🔍 Seria criada (dry-run)');
        }
      } else {
        // Verificar se está no início
        const posicao = filterRules.data.indexOf(regraPaidClients);
        if (posicao > 0) {
          console.log(`   ⚠️  Regra está na posição ${posicao + 1}, movendo para o início...`);
          if (!DRY_RUN) {
            const result = await execMikrotikCommand(
              host,
              user,
              pass,
              `/ip/firewall/filter/move .id=${regraPaidClients['.id']} destination=0`
            );
            if (result.ok) {
              console.log('   ✅ Regra movida para o início!');
            } else {
              console.log(`   ⚠️  Não foi possível mover (pode ser normal): ${result.error}`);
            }
          }
        } else {
          console.log('   ✅ Regra já está no início!');
        }
      }
    }
    console.log('');

    if (!DRY_RUN) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Verificações e correções aplicadas!');
      console.log('');
      console.log('💡 Teste o acesso do cliente agora.');
      console.log('   Se ainda não funcionar, pode ser necessário:');
      console.log('   1. Verificar gateway/rota padrão manualmente no Mikrotik');
      console.log('   2. Verificar se a interface WAN (ether1) está conectada');
      console.log('   3. Verificar logs do firewall: /log print where topics~firewall');
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 Para aplicar as correções, execute sem --dry-run:');
      console.log(`   node corrigir-acesso-internet-completo.js ${mikIdOrIp}`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

