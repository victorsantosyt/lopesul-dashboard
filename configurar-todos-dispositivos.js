#!/usr/bin/env node
// Script para configurar todos os dispositivos no banco de dados
// Garante que cada Mikrotik tenha um dispositivo correspondente com o mikId correto
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mapeamento: IP -> mikId esperado (baseado no identity do Mikrotik)
// ⚠️ AJUSTE ESTES VALORES CONFORME O identity DE CADA MIKROTIK
const MAPEAMENTO_MIKROTIKS = {
  '10.200.200.2': 'LOPESUL-HOTSPOT-01', // ou MIK-BUS-01, dependendo do identity
  '10.200.200.3': 'LOPESUL-HOTSPOT-02',
  '10.200.200.4': 'LOPESUL-HOTSPOT-03',
  '10.200.200.5': 'LOPESUL-HOTSPOT-04',
  '10.200.200.6': 'LOPESUL-HOTSPOT-05',
  '10.200.200.7': 'LOPESUL-HOTSPOT-06', // já configurado
};

async function main() {
  console.log("🔧 Configurando todos os dispositivos...\n");

  try {
    // Buscar todas as frotas
    const frotas = await prisma.frota.findMany();
    if (frotas.length === 0) {
      console.log("❌ Nenhuma frota encontrada. Criando uma padrão...");
      await prisma.frota.create({
        data: { nome: "Frota Padrão", status: "ATIVO" },
      });
    }

    const frotaId = (await prisma.frota.findFirst()).id;
    console.log(`📋 Usando Frota ID: ${frotaId}\n`);

    // Processar cada IP do mapeamento
    for (const [ip, mikIdEsperado] of Object.entries(MAPEAMENTO_MIKROTIKS)) {
      console.log(`\n🔍 Processando IP: ${ip} -> mikId: ${mikIdEsperado}`);

      // Buscar dispositivo existente por IP
      let dispositivo = await prisma.dispositivo.findFirst({
        where: { ip },
      });

      if (dispositivo) {
        console.log(`   ✅ Dispositivo encontrado: ${dispositivo.id}`);
        console.log(`   📝 mikId atual: ${dispositivo.mikId || '(não definido)'}`);

        // Verificar se precisa atualizar o mikId
        if (dispositivo.mikId !== mikIdEsperado) {
          // Verificar se já existe outro dispositivo com esse mikId
          const conflito = await prisma.dispositivo.findUnique({
            where: { mikId: mikIdEsperado },
          });

          if (conflito && conflito.id !== dispositivo.id) {
            console.log(`   ⚠️  Conflito: Já existe dispositivo ${conflito.id} com mikId ${mikIdEsperado}`);
            console.log(`   💡 Removendo mikId do dispositivo conflitante...`);
            await prisma.dispositivo.update({
              where: { id: conflito.id },
              data: { mikId: null },
            });
          }

          console.log(`   🔄 Atualizando mikId para: ${mikIdEsperado}`);
          dispositivo = await prisma.dispositivo.update({
            where: { id: dispositivo.id },
            data: { mikId: mikIdEsperado },
          });
          console.log(`   ✅ Atualizado com sucesso!`);
        } else {
          console.log(`   ✅ mikId já está correto`);
        }

        // Verificar se tem credenciais do Mikrotik
        if (!dispositivo.mikrotikHost || !dispositivo.mikrotikUser || !dispositivo.mikrotikPass) {
          console.log(`   ⚠️  Dispositivo sem credenciais completas do Mikrotik`);
          console.log(`   💡 Configure manualmente: mikrotikHost, mikrotikUser, mikrotikPass`);
        } else {
          console.log(`   ✅ Credenciais do Mikrotik configuradas`);
        }
      } else {
        console.log(`   ❌ Dispositivo não encontrado para IP ${ip}`);
        console.log(`   💡 Criando novo dispositivo...`);
        
        dispositivo = await prisma.dispositivo.create({
          data: {
            ip,
            mikId: mikIdEsperado,
            mikrotikHost: ip, // Assumindo que o host é o mesmo IP
            mikrotikUser: "relay", // ⚠️ AJUSTE SE NECESSÁRIO
            mikrotikPass: "api2025", // ⚠️ AJUSTE A SENHA CORRETA
            frotaId,
          },
        });
        console.log(`   ✅ Dispositivo criado: ${dispositivo.id}`);
      }
    }

    console.log("\n\n✅ Configuração concluída!");
    console.log("\n📋 Resumo dos dispositivos:");
    const todos = await prisma.dispositivo.findMany({
      where: {
        ip: { in: Object.keys(MAPEAMENTO_MIKROTIKS) },
      },
      orderBy: { ip: "asc" },
    });

    todos.forEach(d => {
      console.log(`   ${d.ip} -> mikId: ${d.mikId || '(não definido)'}`);
    });

  } catch (error) {
    console.error("❌ Erro:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

