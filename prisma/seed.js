// prisma/seed.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando seed...');

  const senhaCriptografada = await bcrypt.hash('admin123', 10);

  // ✅ Usa 'nome' no lugar de 'usuario'
  const admin = await prisma.operador.upsert({
    where: { nome: 'admin' },
    update: {},
    create: { nome: 'admin', senha: senhaCriptografada, ativo: true },
  });
  console.log(`✅ Operador '${admin.nome}' pronto.`);

  // Frota de exemplo
  let frota = await prisma.frota.findFirst();
  if (!frota) {
    frota = await prisma.frota.create({ data: { nome: 'Frota demo' } });
    console.log(`🚌 Frota '${frota.nome}' criada.`);
  }

  // Vendas de exemplo
  const vendasCount = await prisma.venda.count({ where: { frotaId: frota.id } });
  if (vendasCount === 0) {
    await prisma.venda.createMany({
      data: [
        { frotaId: frota.id, valorCent: 1000 },
        { frotaId: frota.id, valorCent: 2000 },
        { frotaId: frota.id, valorCent: 3000 },
      ],
    });
    console.log('💰 Vendas de exemplo criadas.');
  } else {
    console.log('ℹ️ Vendas já existentes, nada a criar.');
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed falhou:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }
  );
