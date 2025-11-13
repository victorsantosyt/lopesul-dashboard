#!/usr/bin/env node

// Script para corrigir o redirect do MikroTik hotspot
// Usa a biblioteca node2-mikrotik que já está no projeto

import MikroNode from 'node2-mikrotik';

const MIKROTIK_HOST = process.env.MIKROTIK_HOST || '10.200.200.2';
const MIKROTIK_PORT = parseInt(process.env.MIKROTIK_PORT || '8728');
const MIKROTIK_USER = process.env.MIKROTIK_USER || 'relay';
const MIKROTIK_PASS = process.env.MIKROTIK_PASS || 'api2025';

console.log('🔧 Configurando MikroTik Hotspot Redirect\n');

const device = new MikroNode({
  host: MIKROTIK_HOST,
  port: MIKROTIK_PORT,
  user: MIKROTIK_USER,
  password: MIKROTIK_PASS,
  timeout: 5000
});

async function main() {
  try {
    console.log('1️⃣  Conectando ao MikroTik...');
    await device.connect();
    const channel = device.openChannel();
    
    console.log('✅ Conectado!\n');
    
    // Verificar hotspot
    console.log('2️⃣  Verificando configuração do hotspot...');
    const hotspots = await channel.write('/ip/hotspot/print');
    console.log(`   Hotspots configurados: ${hotspots.length}`);
    
    if (hotspots.length > 0) {
      hotspots.forEach(hs => {
        console.log(`   - ${hs.name}: interface=${hs.interface}, profile=${hs.profile}`);
      });
    }
    
    // Verificar perfil
    console.log('\n3️⃣  Verificando perfil hotspot-lopesul...');
    const profiles = await channel.write('/ip/hotspot/profile/print', ['?name=hotspot-lopesul']);
    
    if (profiles.length === 0) {
      console.log('   ❌ Perfil hotspot-lopesul não encontrado!');
    } else {
      const profile = profiles[0];
      console.log(`   ✅ Perfil encontrado:`);
      console.log(`      html-directory: ${profile['html-directory'] || 'hotspot'}`);
      console.log(`      http-cookie-lifetime: ${profile['http-cookie-lifetime']}`);
      console.log(`      login-by: ${profile['login-by']}`);
      
      // Garantir que html-directory está correto
      if (profile['html-directory'] !== 'hotspot') {
        console.log('\n   🔧 Corrigindo html-directory para "hotspot"...');
        await channel.write('/ip/hotspot/profile/set', [
          `=.id=${profile['.id']}`,
          '=html-directory=hotspot'
        ]);
        console.log('   ✅ html-directory atualizado!');
      }
    }
    
    // Verificar walled garden
    console.log('\n4️⃣  Verificando walled garden...');
    const walled = await channel.write('/ip/hotspot/walled-garden/print');
    console.log(`   Total de regras: ${walled.length}`);
    
    const requiredDomains = [
      'cativo.lopesuldashboardwifi.com',
      'painel.lopesuldashboardwifi.com',
      '*.pagar.me',
      'api.pagar.me'
    ];
    
    requiredDomains.forEach(domain => {
      const exists = walled.some(w => w['dst-host'] === domain);
      console.log(`   ${exists ? '✅' : '❌'} ${domain}`);
    });
    
    // Verificar arquivos hotspot
    console.log('\n5️⃣  Verificando arquivos do hotspot...');
    const files = await channel.write('/file/print', ['?name~hotspot']);
    
    const redirectExists = files.some(f => f.name.includes('hotspot/redirect.html'));
    console.log(`   ${redirectExists ? '✅' : '❌'} redirect.html`);
    
    if (!redirectExists) {
      console.log('\n   ⚠️  ATENÇÃO: redirect.html não encontrado!');
      console.log('   📝 Crie o arquivo manualmente no MikroTik:');
      console.log('      Files > Upload > hotspot/redirect.html');
      console.log('\n   Conteúdo do arquivo:');
      console.log('   -----------------------------------');
      console.log('   <html><head>');
      console.log('   <meta http-equiv="refresh" content="0;');
      console.log('   url=https://cativo.lopesuldashboardwifi.com/pagamento.html?mac=$(mac)&ip=$(ip)&link-orig=$(link-orig-esc)">');
      console.log('   </head><body>Redirecionando...</body></html>');
      console.log('   -----------------------------------');
    }
    
    device.close();
    
    console.log('\n✅ Verificação concluída!\n');
    
    console.log('📋 Status:');
    console.log(`   Hotspot: ${hotspots.length > 0 ? '✅ Ativo' : '❌ Inativo'}`);
    console.log(`   Perfil: ${profiles.length > 0 ? '✅ Configurado' : '❌ Não encontrado'}`);
    console.log(`   Redirect: ${redirectExists ? '✅ Presente' : '❌ Ausente'}`);
    
    if (!redirectExists) {
      console.log('\n⚠️  PROBLEMA IDENTIFICADO: redirect.html não está no MikroTik!');
      console.log('   Isso explica por que o MAC e IP não estão sendo passados.\n');
    }
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    device.close();
    process.exit(1);
  }
}

main();
