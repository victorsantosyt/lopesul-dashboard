#!/usr/bin/env node

// Script simples para verificar configuração do hotspot MikroTik
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const MikroNode = require('node2-mikrotik');

const MIKROTIK_HOST = '10.200.200.2';
const MIKROTIK_PORT = 8728;
const MIKROTIK_USER = 'relay';
const MIKROTIK_PASS = 'api2025';

console.log('🔍 Verificando configuração do MikroTik Hotspot\n');

const device = new MikroNode({
  host: MIKROTIK_HOST,
  port: MIKROTIK_PORT,
  user: MIKROTIK_USER,
  password: MIKROTIK_PASS,
  timeout: 10000
});

async function main() {
  try {
    console.log('📡 Conectando ao MikroTik...');
    await device.connect();
    const channel = device.openChannel();
    console.log('✅ Conectado!\n');
    
    // Verificar hotspot
    console.log('📊 Hotspot:');
    const hotspots = await channel.write('/ip/hotspot/print');
    if (hotspots.length === 0) {
      console.log('   ❌ Nenhum hotspot configurado!\n');
      device.close();
      return;
    }
    
    hotspots.forEach(hs => {
      console.log(`   ✅ ${hs.name}`);
      console.log(`      Interface: ${hs.interface}`);
      console.log(`      Profile: ${hs.profile}`);
      console.log(`      Address Pool: ${hs['address-pool']}`);
    });
    
    // Verificar perfil
    console.log('\n📊 Perfil hotspot-lopesul:');
    const profiles = await channel.write('/ip/hotspot/profile/print');
    const lopesulProfile = profiles.find(p => p.name === 'hotspot-lopesul');
    
    if (!lopesulProfile) {
      console.log('   ❌ Perfil não encontrado!\n');
    } else {
      console.log(`   ✅ Perfil encontrado`);
      console.log(`      HTML Directory: ${lopesulProfile['html-directory'] || 'hotspot'}`);
      console.log(`      Login By: ${lopesulProfile['login-by']}`);
      console.log(`      HTTP Cookie Lifetime: ${lopesulProfile['http-cookie-lifetime']}`);
    }
    
    // Verificar arquivos
    console.log('\n📊 Arquivos do hotspot:');
    const files = await channel.write('/file/print');
    const hotspotFiles = files.filter(f => f.name && f.name.includes('hotspot'));
    
    console.log(`   Total de arquivos hotspot: ${hotspotFiles.length}`);
    
    const redirectFile = hotspotFiles.find(f => f.name.includes('redirect.html'));
    if (redirectFile) {
      console.log(`   ✅ redirect.html encontrado: ${redirectFile.name}`);
      console.log(`      Tamanho: ${redirectFile.size} bytes`);
    } else {
      console.log('   ❌ redirect.html NÃO encontrado!');
      console.log('\n   🚨 PROBLEMA IDENTIFICADO:');
      console.log('      O arquivo redirect.html não está no MikroTik!');
      console.log('      Isso explica por que MAC e IP não são passados para o portal.');
    }
    
    // Listar arquivos hotspot
    if (hotspotFiles.length > 0) {
      console.log('\n   Arquivos encontrados:');
      hotspotFiles.forEach(f => {
        console.log(`      - ${f.name} (${f.size} bytes)`);
      });
    }
    
    // Verificar walled garden
    console.log('\n📊 Walled Garden:');
    const walled = await channel.write('/ip/hotspot/walled-garden/print');
    console.log(`   Total de regras: ${walled.length}`);
    
    const domains = ['cativo.lopesuldashboardwifi.com', 'painel.lopesuldashboardwifi.com', '*.pagar.me', 'api.pagar.me'];
    domains.forEach(domain => {
      const exists = walled.some(w => w['dst-host'] === domain);
      console.log(`   ${exists ? '✅' : '❌'} ${domain}`);
    });
    
    device.close();
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMO:');
    console.log('='.repeat(60));
    console.log(`Hotspot: ${hotspots.length > 0 ? '✅ Ativo' : '❌ Inativo'}`);
    console.log(`Perfil: ${lopesulProfile ? '✅ Configurado' : '❌ Faltando'}`);
    console.log(`Redirect: ${redirectFile ? '✅ Presente' : '❌ AUSENTE (PROBLEMA!)'}`);
    console.log(`Walled Garden: ${walled.length} regras`);
    
    if (!redirectFile) {
      console.log('\n🔧 SOLUÇÃO:');
      console.log('   1. Crie o arquivo redirect.html no MikroTik');
      console.log('   2. Caminho: hotspot/redirect.html');
      console.log('   3. Conteúdo:');
      console.log('\n<html><head>');
      console.log('<meta http-equiv="refresh" content="0;');
      console.log('url=https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=$(mac)&ip=$(ip)&link-orig=$(link-orig-esc)">');
      console.log('</head><body>Redirecionando...</body></html>');
    }
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    console.error(error);
    device.close();
    process.exit(1);
  }
}

main();
