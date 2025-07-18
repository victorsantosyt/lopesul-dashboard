import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Criar operador com senha criptografada
  const senhaCriptografada = await bcrypt.hash('admin123', 10);
  await prisma.operador.create({
    data: {
      usuario: 'admin',
      senha: senhaCriptografada
    }
  });

  // Criar frota de teste
  const frota = await prisma.frota.create({
    data: {}
  });

  // Criar vendas associadas à frota
  await prisma.venda.createMany({
    data: [
      { frotaId: frota.id, valor: 10.0 },
      { frotaId: frota.id, valor: 15.0 },
      { frotaId: frota.id, valor: 20.0 },
    ],
  });

  console.log("Operador, frota e vendas criados com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
