#!/usr/bin/env node
/**
 * Script para debugar o que a página de acessos está recebendo
 * Simula a lógica da página para verificar se a sessão aparece
 */

import fetch from 'node-fetch';

const IP = process.argv[2] || '192.168.88.94';
const API_URL = process.env.API_URL || 'https://painel.lopesuldashboardwifi.com';

// Simular a lógica da página
function yyyymmddLocal(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

async function main() {
  try {
    console.log('🔍 Simulando lógica da página de acessos...');
    console.log(`   IP: ${IP}`);
    console.log('');

    // Simular filtro "Últimas 24h" (padrão da página)
    const now = new Date();
    const from = addDays(now, -1);
    const to = now;

    const fromStr = yyyymmddLocal(from);
    const toStr = yyyymmddLocal(to);

    console.log(`📅 Filtro de data (Últimas 24h):`);
    console.log(`   From: ${fromStr} (${from.toISOString()})`);
    console.log(`   To: ${toStr} (${to.toISOString()})`);
    console.log('');

    const url = `${API_URL}/api/sessoes?from=${fromStr}&to=${toStr}`;
    console.log(`📡 Chamando API: ${url}`);
    console.log('');

    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data)) {
      console.log('❌ Resposta não é um array:', data);
      return;
    }

    console.log(`✅ Total de sessões retornadas: ${data.length}`);
    console.log('');

    // Simular a lógica da página
    const nowLocal = new Date();
    const mapped = data.map((s) => {
      const inicio = s.inicioEm ? new Date(s.inicioEm) : null;
      const expira = s.expiraEm ? new Date(s.expiraEm) : null;
      const ativo = !!s.ativo && (!expira || expira > nowLocal);
      return {
        id: s.id,
        ip: s.ipCliente,
        mac: s.macCliente,
        inicio: inicio?.toISOString(),
        expira: expira?.toISOString(),
        ativoBanco: s.ativo,
        ativoCalculado: ativo,
        status: ativo ? 'Ativo' : (expira && expira <= nowLocal ? 'Expirado' : 'Inativo'),
      };
    });

    // Buscar sessão específica
    const sessaoEncontrada = mapped.find(s => s.ip === IP);

    if (sessaoEncontrada) {
      console.log('✅ Sessão encontrada na lista processada:');
      console.log(`   ID: ${sessaoEncontrada.id}`);
      console.log(`   IP: ${sessaoEncontrada.ip}`);
      console.log(`   MAC: ${sessaoEncontrada.mac || 'N/A'}`);
      console.log(`   Início: ${sessaoEncontrada.inicio}`);
      console.log(`   Expira: ${sessaoEncontrada.expira}`);
      console.log(`   Ativo (banco): ${sessaoEncontrada.ativoBanco}`);
      console.log(`   Ativo (calculado): ${sessaoEncontrada.ativoCalculado}`);
      console.log(`   Status: ${sessaoEncontrada.status}`);
      console.log('');
      console.log('💡 A sessão DEVERIA aparecer na página como:', sessaoEncontrada.status);
    } else {
      console.log(`❌ Sessão com IP ${IP} NÃO encontrada na lista processada!`);
      console.log('');
      console.log('📋 Sessões processadas:');
      mapped.slice(0, 10).forEach((s, idx) => {
        console.log(`   ${idx + 1}. IP: ${s.ip}, Status: ${s.status}, Ativo: ${s.ativoCalculado}`);
      });
    }

    // Verificar se está na lista original
    const sessaoOriginal = data.find(s => s.ipCliente === IP);
    if (sessaoOriginal && !sessaoEncontrada) {
      console.log('');
      console.log('⚠️  Sessão está na resposta da API mas não passou pelo processamento!');
      console.log('   Isso indica um problema na lógica de mapeamento.');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  }
}

main();

