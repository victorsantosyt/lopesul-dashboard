// prisma/seed.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1) Operador admin (não sobrescreve senha se já existir)
  const senhaCriptografada = await bcrypt.hash('admin123', 10);
  const admin = await prisma.operador.upsert({
    where: { nome: 'admin' },           // <- campo correto no Prisma Client
    update: {},                         // evite trocar senha sem querer
    create: { nome: 'admin', senha: senhaCriptografada, ativo: true },
  });
  console.log(`Operador '${admin.nome}' pronto.`);

  // 2) Frota de exemplo (cria só se não houver nenhuma)
  let frota = await prisma.frota.findFirst();
  if (!frota) {
    frota = await prisma.frota.create({ data: { nome: 'Frota demo' } });
    console.log(`Frota '${frota.nome}' criada.`);
  } else {
    console.log(`Usando frota existente (${frota.id}).`);
  }

  // 3) Vendas ligadas à frota (só se ainda não existirem)
  const vendasCount = await prisma.venda.count({ where: { frotaId: frota.id } });
  if (vendasCount === 0) {
    await prisma.venda.createMany({
      data: [
        { frotaId: frota.id, valor: 10.0 },
        { frotaId: frota.id, valor: 15.0 },
        { frotaId: frota.id, valor: 20.0 },
      ],
    });
    console.log('Vendas de exemplo criadas.');
  } else {
    console.log('Vendas já existem; nada a fazer.');
  }
}

main()
  .catch((e) => {
    console.error('Seed falhou:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
