#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Criando dispositivo LOPESUL-HOTSPOT-06...\n");

  try {
    // Verificar se já existe
    const existente = await prisma.dispositivo.findUnique({
      where: { mikId: "LOPESUL-HOTSPOT-06" },
    });

    if (existente) {
      console.log("✅ Dispositivo já existe:");
      console.log(JSON.stringify(existente, null, 2));
      return;
    }

    // Buscar uma frota para associar
    const frota = await prisma.frota.findFirst();
    
    if (!frota) {
      console.log("❌ Nenhuma frota encontrada. Criando uma nova...");
      const novaFrota = await prisma.frota.create({
        data: {
          nome: "Frota Padrão",
          status: "ATIVO",
        },
      });
      console.log("✅ Frota criada:", novaFrota.id);
    }

    const frotaId = frota?.id || (await prisma.frota.findFirst()).id;

    // Verificar se já existe um dispositivo com IP 10.200.200.7
    const dispositivoExistente = await prisma.dispositivo.findFirst({
      where: { ip: "10.200.200.7" },
    });

    if (dispositivoExistente) {
      console.log("⚠️  Já existe um dispositivo com IP 10.200.200.7:");
      console.log(JSON.stringify(dispositivoExistente, null, 2));
      console.log("\n💡 Opção 1: Atualizar o mikId do dispositivo existente");
      console.log("💡 Opção 2: Criar um novo dispositivo com IP diferente");
      console.log("\n📝 Para atualizar o mikId, execute:");
      console.log(`
        await prisma.dispositivo.update({
          where: { id: "${dispositivoExistente.id}" },
          data: { mikId: "LOPESUL-HOTSPOT-06" },
        });
      `);
      return;
    }

    // Criar o dispositivo
    // ⚠️ AJUSTE OS VALORES ABAIXO CONFORME NECESSÁRIO
    const dispositivo = await prisma.dispositivo.create({
      data: {
        mikId: "LOPESUL-HOTSPOT-06",
        ip: "10.200.200.7",  // ⚠️ AJUSTE SE NECESSÁRIO
        mikrotikHost: "10.200.200.7",  // ⚠️ AJUSTE SE NECESSÁRIO
        mikrotikUser: "relay",  // ⚠️ AJUSTE SE NECESSÁRIO
        mikrotikPass: "api2025",  // ⚠️ AJUSTE A SENHA CORRETA
        frotaId: frotaId,
      },
    });

    console.log("✅ Dispositivo criado com sucesso:");
    console.log(JSON.stringify(dispositivo, null, 2));

  } catch (error) {
    console.error("❌ Erro:", error);
    if (error.code === 'P2002') {
      console.log("\n💡 Erro: Já existe um dispositivo com este mikId ou IP");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();

