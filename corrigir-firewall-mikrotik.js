#!/usr/bin/env node
// Script para corrigir regras de firewall do Mikrotik
// Uso: node corrigir-firewall-mikrotik.js [mikId ou IP do roteador] [--dry-run]

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
    
    console.log('🔧 Corrigindo regras de firewall do Mikrotik...');
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

    // Verificar regras existentes
    const filterRules = await execMikrotikCommand(host, user, pass, '/ip/firewall/filter/print where chain=forward');
    if (!filterRules.ok) {
      console.log(`❌ Erro ao buscar regras: ${filterRules.error}`);
      return;
    }

    const regrasExistentes = filterRules.data || [];
    const regraPaidClients = regrasExistentes.find(r => 
      r['src-address-list'] === 'paid_clients' && 
      r.action === 'accept' &&
      r.chain === 'forward'
    );

    if (regraPaidClients) {
      if (regraPaidClients.disabled === 'true') {
        console.log('⚠️  Regra para paid_clients existe mas está DESABILITADA!');
        if (!DRY_RUN) {
          const result = await execMikrotikCommand(
            host, 
            user, 
            pass, 
            `/ip/firewall/filter/enable .id=${regraPaidClients['.id']}`
          );
          if (result.ok) {
            console.log('   ✅ Regra habilitada!');
          } else {
            console.log(`   ❌ Erro ao habilitar: ${result.error}`);
          }
        } else {
          console.log('   🔍 Seria habilitada (dry-run)');
        }
      } else {
        console.log('✅ Regra para paid_clients já existe e está ativa!');
      }
    } else {
      console.log('❌ Regra para paid_clients NÃO existe!');
      console.log('   Criando regra...');
      
      if (!DRY_RUN) {
        const result = await execMikrotikCommand(
          host,
          user,
          pass,
          '/ip/firewall/filter/add chain=forward src-address-list=paid_clients action=accept comment="Liberar internet para clientes pagos" place-before=0'
        );
        
        if (result.ok) {
          console.log('   ✅ Regra criada com sucesso!');
        } else {
          console.log(`   ❌ Erro ao criar regra: ${result.error}`);
        }
      } else {
        console.log('   🔍 Seria criada (dry-run)');
        console.log('   Comando: /ip/firewall/filter/add chain=forward src-address-list=paid_clients action=accept comment="Liberar internet para clientes pagos" place-before=0');
      }
    }
    console.log('');

    // Verificar DNS
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Verificando DNS...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const dns = await execMikrotikCommand(host, user, pass, '/ip/dns/print');
    if (dns.ok && Array.isArray(dns.data) && dns.data.length > 0) {
      const dnsConfig = dns.data[0];
      if (!dnsConfig.servers || dnsConfig.servers === '') {
        console.log('⚠️  DNS não configurado!');
        if (!DRY_RUN) {
          const result = await execMikrotikCommand(
            host,
            user,
            pass,
            '/ip/dns/set servers=8.8.8.8,8.8.4.4 allow-remote-requests=yes'
          );
          if (result.ok) {
            console.log('   ✅ DNS configurado!');
          } else {
            console.log(`   ❌ Erro ao configurar DNS: ${result.error}`);
          }
        } else {
          console.log('   🔍 Seria configurado (dry-run)');
        }
      } else {
        console.log(`✅ DNS configurado: ${dnsConfig.servers}`);
      }
    }
    console.log('');

    if (!DRY_RUN) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Correções aplicadas!');
      console.log('');
      console.log('💡 Teste o acesso do cliente agora.');
    } else {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 Para aplicar as correções, execute sem --dry-run:');
      console.log(`   node corrigir-firewall-mikrotik.js ${mikIdOrIp}`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

