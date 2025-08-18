// src/app/api/operadores/[id]/route.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  const id = parseInt(params.id);
  const data = await request.json();

  const updateData = {};
  if (data.nome) updateData.nome = data.nome;
  if (data.senha) updateData.senha = await bcrypt.hash(data.senha, 10);
  if (typeof data.ativo === 'boolean') updateData.ativo = data.ativo;

  const operador = await prisma.operador.update({
    where: { id },
    data: updateData,
  });

  return Response.json(operador);
}

export async function DELETE(_, { params }) {
  const id = parseInt(params.id);

  await prisma.operador.delete({
    where: { id },
  });

  return Response.json({ status: 'Operador deletado' });
}