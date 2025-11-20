#!/usr/bin/env node
// Script para limpar sessões expiradas
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Limpando sessões expiradas...\n");

  try {
    const agora = new Date();

    // Buscar sessões expiradas que ainda estão ativas
    const sessoesExpiradas = await prisma.sessaoAtiva.findMany({
      where: {
        ativo: true,
        expiraEm: { lt: agora },
      },
    });

    console.log(`📊 Sessões expiradas encontradas: ${sessoesExpiradas.length}`);

    if (sessoesExpiradas.length === 0) {
      console.log("✅ Nenhuma sessão expirada para limpar!");
      return;
    }

    // Desativar sessões expiradas
    const resultado = await prisma.sessaoAtiva.updateMany({
      where: {
        ativo: true,
        expiraEm: { lt: agora },
      },
      data: {
        ativo: false,
      },
    });

    console.log(`✅ ${resultado.count} sessões desativadas com sucesso!`);

  } catch (error) {
    console.error("❌ Erro ao limpar sessões:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

