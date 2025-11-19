#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Atualizando mikId para LOPESUL-HOTSPOT-06...\n");

  try {
    // Buscar dispositivo com IP 10.200.200.7 ou mikId MIK-BUS-06
    const dispositivo = await prisma.dispositivo.findFirst({
      where: {
        OR: [
          { ip: "10.200.200.7" },
          { mikId: "MIK-BUS-06" },
        ],
      },
    });

    if (!dispositivo) {
      console.log("❌ Dispositivo não encontrado com IP 10.200.200.7 ou mikId MIK-BUS-06");
      return;
    }

    console.log("📋 Dispositivo encontrado:");
    console.log(JSON.stringify(dispositivo, null, 2));

    // Verificar se já tem o mikId correto
    if (dispositivo.mikId === "LOPESUL-HOTSPOT-06") {
      console.log("\n✅ Dispositivo já tem mikId = LOPESUL-HOTSPOT-06");
      return;
    }

    // Atualizar o mikId
    const atualizado = await prisma.dispositivo.update({
      where: { id: dispositivo.id },
      data: { mikId: "LOPESUL-HOTSPOT-06" },
    });

    console.log("\n✅ Dispositivo atualizado com sucesso:");
    console.log(JSON.stringify(atualizado, null, 2));

  } catch (error) {
    console.error("❌ Erro:", error);
    if (error.code === 'P2002') {
      console.log("\n💡 Erro: Já existe outro dispositivo com mikId = LOPESUL-HOTSPOT-06");
      console.log("   Você pode precisar remover ou atualizar o outro dispositivo primeiro");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();

