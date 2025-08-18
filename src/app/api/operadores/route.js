import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function GET() {
  const operadores = await prisma.operador.findMany({
    orderBy: { criadoEm: 'desc' },
  });

  return new Response(JSON.stringify(operadores), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request) {
  const data = await request.json();

  if (!data.nome || !data.senha) {
    return new Response('Nome e senha são obrigatórios.', { status: 400 });
  }

  const senhaHash = await bcrypt.hash(data.senha, 10);

  const operador = await prisma.operador.create({
    data: {
      nome: data.nome,
      senha: senhaHash,
      ativo: true,
    },
  });

  return new Response(JSON.stringify(operador), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}
