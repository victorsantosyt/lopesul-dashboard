#!/usr/bin/env node
/**
 * Script para testar a API de sessões e verificar se retorna a sessão específica
 * 
 * Uso:
 *   node testar-api-sessoes.js [IP]
 */

import fetch from 'node-fetch';

const IP = process.argv[2] || '192.168.88.94';
const API_URL = process.env.API_URL || 'https://painel.lopesuldashboardwifi.com';

async function main() {
  try {
    console.log('🔍 Testando API de sessões...');
    console.log(`   IP: ${IP}`);
    console.log(`   API: ${API_URL}`);
    console.log('');

    // Testar com diferentes filtros de data
    const hoje = new Date();
    const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
    
    const formatDate = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const from = formatDate(ontem);
    const to = formatDate(hoje);

    console.log(`📅 Buscando sessões de ${from} até ${to}...`);
    console.log('');

    const url = `${API_URL}/api/sessoes?from=${from}&to=${to}`;
    console.log(`📡 URL: ${url}`);
    console.log('');

    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data)) {
      console.log('❌ Resposta não é um array:', data);
      return;
    }

    console.log(`✅ Total de sessões retornadas: ${data.length}`);
    console.log('');

    // Buscar sessão específica
    const sessaoEncontrada = data.find(s => s.ipCliente === IP);

    if (sessaoEncontrada) {
      console.log('✅ Sessão encontrada na API:');
      console.log(`   ID: ${sessaoEncontrada.id}`);
      console.log(`   IP: ${sessaoEncontrada.ipCliente}`);
      console.log(`   MAC: ${sessaoEncontrada.macCliente || 'N/A'}`);
      console.log(`   Plano: ${sessaoEncontrada.plano || 'N/A'}`);
      console.log(`   Início: ${sessaoEncontrada.inicioEm}`);
      console.log(`   Expira: ${sessaoEncontrada.expiraEm}`);
      console.log(`   Ativo: ${sessaoEncontrada.ativo ? 'Sim' : 'Não'}`);
      console.log(`   Nome: ${sessaoEncontrada.nome || 'N/A'}`);
    } else {
      console.log(`❌ Sessão com IP ${IP} NÃO encontrada na API!`);
      console.log('');
      console.log('📋 Sessões retornadas:');
      data.slice(0, 10).forEach((s, idx) => {
        console.log(`   ${idx + 1}. IP: ${s.ipCliente}, MAC: ${s.macCliente || 'N/A'}, Ativo: ${s.ativo}, Início: ${s.inicioEm}`);
      });
      if (data.length > 10) {
        console.log(`   ... e mais ${data.length - 10} sessões`);
      }
    }

    // Testar sem filtro de data
    console.log('');
    console.log('🔍 Testando sem filtro de data...');
    const urlSemFiltro = `${API_URL}/api/sessoes?limit=100`;
    const response2 = await fetch(urlSemFiltro);
    const data2 = await response2.json();

    if (Array.isArray(data2)) {
      const sessaoSemFiltro = data2.find(s => s.ipCliente === IP);
      if (sessaoSemFiltro) {
        console.log('✅ Sessão encontrada SEM filtro de data!');
        console.log(`   Isso indica que o problema é no filtro de data.`);
      } else {
        console.log('❌ Sessão NÃO encontrada mesmo sem filtro de data.');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  }
}

main();

