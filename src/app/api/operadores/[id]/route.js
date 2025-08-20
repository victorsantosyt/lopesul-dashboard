// src/app/api/operadores/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PUT(req, { params }) {
  const id = String(params.id);
  const { nome, usuario, senha } = await req.json();

  const data = {};
  if ((usuario || nome)?.trim()) data.usuario = (usuario || nome).trim();
  if (senha?.trim()) data.senha = await bcrypt.hash(senha.trim(), 10);

  const op = await prisma.operador.update({
    where: { id },
    data,
    select: { id: true, usuario: true, criadoEm: true },
  });

  return NextResponse.json(op);
}

export async function DELETE(_req, { params }) {
  const id = String(params.id);
  await prisma.operador.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
