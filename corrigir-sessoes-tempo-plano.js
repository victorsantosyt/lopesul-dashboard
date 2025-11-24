#!/usr/bin/env node
// Script para corrigir sessões ativas que foram criadas com tempo incorreto
// Recalcula o tempo de expiração baseado no plano do pedido
// Uso: node corrigir-sessoes-tempo-plano.js [--dry-run]

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

// Função para calcular minutos baseado no plano (mesma lógica do plan-duration.js)
function calcularMinutosPlano(descricao) {
  if (!descricao) return 120; // Default 2 horas
  
  const desc = String(descricao).toLowerCase();
  
  const PLANOS_MIN = {
    'acesso 12h': 12 * 60,
    'acesso 24h': 24 * 60,
    'acesso 48h': 48 * 60,
    '12h': 12 * 60,
    '24h': 24 * 60,
    '48h': 48 * 60,
    '12 horas': 12 * 60,
    '24 horas': 24 * 60,
    '48 horas': 48 * 60,
  };
  
  // Verificar se está no mapa de planos
  for (const [key, minutos] of Object.entries(PLANOS_MIN)) {
    if (desc.includes(key)) {
      return minutos;
    }
  }
  
  // Tentar extrair padrões como "12h", "24h", "48h"
  const match = desc.match(/(\d+)\s*(?:h|horas?)/i);
  if (match) {
    const horas = parseInt(match[1], 10);
    if (horas > 0 && horas <= 168) { // Máximo 7 dias
      return horas * 60;
    }
  }
  
  return 120; // Default 2 horas
}

async function main() {
  try {
    const dryRun = process.argv.includes('--dry-run');
    
    if (dryRun) {
      console.log('🔍 MODO DRY-RUN: Nenhuma alteração será feita');
      console.log('');
    }

    console.log('🔍 Buscando sessões ativas com pedidos associados...');
    console.log('');

    // Buscar todas as sessões ativas com pedidos
    const sessoes = await prisma.sessaoAtiva.findMany({
      where: {
        pedidoId: { not: null },
        ativo: true,
      },
      include: {
        pedido: {
          select: {
            id: true,
            code: true,
            description: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { inicioEm: 'desc' },
    });

    console.log(`✅ ${sessoes.length} sessão(ões) ativa(s) encontrada(s)`);
    console.log('');

    if (sessoes.length === 0) {
      console.log('✅ Nenhuma sessão para corrigir.');
      return;
    }

    const agora = new Date();
    let corrigidas = 0;
    let semCorrecao = 0;

    for (const sessao of sessoes) {
      if (!sessao.pedido) continue;

      const descricao = sessao.pedido.description || sessao.plano || '';
      const minutosEsperados = calcularMinutosPlano(descricao);
      const minutosAtuais = sessao.expiraEm ? Math.floor((sessao.expiraEm - sessao.inicioEm) / 60000) : 0;
      
      // Se os minutos são diferentes, precisa corrigir
      if (Math.abs(minutosAtuais - minutosEsperados) > 5) { // Tolerância de 5 minutos
        const novaExpiraEm = new Date(sessao.inicioEm.getTime() + minutosEsperados * 60 * 1000);
        const expirada = novaExpiraEm < agora;
        
        console.log(`📋 Sessão ${sessao.id}:`);
        console.log(`   IP: ${sessao.ipCliente}`);
        console.log(`   Plano: ${descricao || 'N/A'}`);
        console.log(`   Minutos atuais: ${minutosAtuais} min`);
        console.log(`   Minutos esperados: ${minutosEsperados} min`);
        console.log(`   Expira atual: ${sessao.expiraEm.toISOString()}`);
        console.log(`   Expira nova: ${novaExpiraEm.toISOString()}`);
        console.log(`   Status: ${expirada ? '⏰ EXPIRADA' : '✅ ATIVA'}`);
        
        if (!dryRun) {
          try {
            await prisma.sessaoAtiva.update({
              where: { id: sessao.id },
              data: {
                expiraEm: novaExpiraEm,
                ativo: !expirada, // Se expirou, marcar como inativa
              },
            });
            console.log(`   ✅ Corrigida!`);
            corrigidas++;
          } catch (err) {
            console.log(`   ❌ Erro ao corrigir: ${err.message}`);
          }
        } else {
          console.log(`   🔍 [DRY-RUN] Seria corrigida`);
          corrigidas++;
        }
        console.log('');
      } else {
        semCorrecao++;
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (dryRun) {
      console.log(`🔍 DRY-RUN: ${corrigidas} sessão(ões) seriam corrigida(s), ${semCorrecao} sem necessidade de correção`);
    } else {
      console.log(`✅ ${corrigidas} sessão(ões) corrigida(s), ${semCorrecao} sem necessidade de correção`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();

