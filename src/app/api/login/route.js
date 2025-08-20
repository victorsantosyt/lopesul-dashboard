import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    const { usuario, senha } = await req.json();
    if (!usuario || !senha) {
      return NextResponse.json({ error: 'Usuário e senha são obrigatórios.' }, { status: 400 });
    }

    const op = await prisma.operador.findUnique({ where: { usuario } });
    if (!op) return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 });

    const ok = await bcrypt.compare(senha, op.senha);
    if (!ok) return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 });

    const res = NextResponse.json({ id: op.id, usuario: op.usuario });
    res.cookies.set('token', op.id, {
      httpOnly: true, sameSite: 'lax', path: '/',
      maxAge: 60 * 60 * 12,
      secure: process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (e) {
    console.error('POST /api/login', e);
    return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 });
  }
}
