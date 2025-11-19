#!/usr/bin/env node
// Script para renomear todos os dispositivos no banco de dados
// Padroniza os mikId para LOPESUL-HOTSPOT-01, LOPESUL-HOTSPOT-02, etc.
// Depois você só precisa configurar o identity em cada Mikrotik para corresponder
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapeamento: IP -> novo mikId
// Você pode ajustar esses valores conforme necessário
const MAPEAMENTO_IPS = {
  '10.200.200.2': 'LOPESUL-HOTSPOT-01',
  '10.200.200.3': 'LOPESUL-HOTSPOT-02',
  '10.200.200.4': 'LOPESUL-HOTSPOT-03',
  '10.200.200.5': 'LOPESUL-HOTSPOT-04',
  '10.200.200.6': 'LOPESUL-HOTSPOT-05',
  '10.200.200.7': 'LOPESUL-HOTSPOT-06',
};

async function main() {
  console.log("🔧 Renomeando todos os dispositivos no banco de dados...\n");
  console.log("⚠️  ATENÇÃO: Depois de renomear, configure o identity em cada Mikrotik para corresponder!\n");

  try {
    // Buscar todos os dispositivos
    const todosDispositivos = await prisma.dispositivo.findMany({
      orderBy: { ip: 'asc' },
    });

    console.log(`📊 Total de dispositivos encontrados: ${todosDispositivos.length}\n`);

    // Processar cada dispositivo
    for (const dispositivo of todosDispositivos) {
      const ip = dispositivo.ip;
      const novoMikId = MAPEAMENTO_IPS[ip];

      if (!novoMikId) {
        console.log(`⚠️  IP ${ip} não está no mapeamento, pulando...`);
        continue;
      }

      console.log(`🔍 Processando IP: ${ip}`);
      console.log(`   mikId atual: ${dispositivo.mikId || '(não definido)'}`);
      console.log(`   novo mikId: ${novoMikId}`);

      // Verificar se já está correto
      if (dispositivo.mikId === novoMikId) {
        console.log(`   ✅ Já está correto, pulando...\n`);
        continue;
      }

      // Verificar se já existe outro dispositivo com esse mikId
      const conflito = await prisma.dispositivo.findUnique({
        where: { mikId: novoMikId },
      });

      if (conflito && conflito.id !== dispositivo.id) {
        console.log(`   ⚠️  Conflito: Já existe dispositivo ${conflito.id} (IP: ${conflito.ip}) com mikId ${novoMikId}`);
        console.log(`   💡 Removendo mikId do dispositivo conflitante...`);
        await prisma.dispositivo.update({
          where: { id: conflito.id },
          data: { mikId: null },
        });
        console.log(`   ✅ Conflito resolvido`);
      }

      // Atualizar o mikId
      try {
        const atualizado = await prisma.dispositivo.update({
          where: { id: dispositivo.id },
          data: { mikId: novoMikId },
        });
        console.log(`   ✅ Dispositivo renomeado com sucesso!`);
        console.log(`   📝 Novo mikId: ${atualizado.mikId}\n`);
      } catch (error) {
        console.error(`   ❌ Erro ao renomear:`, error.message);
        console.log(`\n`);
      }
    }

    console.log("\n✅ Renomeação concluída!\n");

    // Mostrar resumo
    console.log("📋 Resumo dos dispositivos renomeados:");
    const dispositivosRenomeados = await prisma.dispositivo.findMany({
      where: {
        ip: { in: Object.keys(MAPEAMENTO_IPS) },
      },
      orderBy: { ip: 'asc' },
    });

    console.log("\n| IP            | mikId                | Status |");
    console.log("|---------------|----------------------|--------|");
    for (const d of dispositivosRenomeados) {
      const esperado = MAPEAMENTO_IPS[d.ip];
      const status = d.mikId === esperado ? "✅ OK" : "❌ DIFERENTE";
      console.log(`| ${d.ip.padEnd(13)} | ${(d.mikId || '(não definido)').padEnd(20)} | ${status} |`);
    }

    console.log("\n📝 PRÓXIMOS PASSOS:");
    console.log("1. Configure o identity em cada Mikrotik para corresponder ao mikId:");
    for (const [ip, mikId] of Object.entries(MAPEAMENTO_IPS)) {
      console.log(`   - Mikrotik ${ip}: /system identity set name="${mikId}"`);
    }
    console.log("\n2. Configure o redirect.html em cada Mikrotik:");
    for (const [ip, mikId] of Object.entries(MAPEAMENTO_IPS)) {
      console.log(`   - Mikrotik ${ip}: Atualize redirect.html com mikId="${mikId}"`);
    }
    console.log("\n3. Teste cada Mikrotik conectando um celular no Wi-Fi");

  } catch (error) {
    console.error("❌ Erro:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

