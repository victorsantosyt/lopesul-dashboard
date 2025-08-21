import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    const { usuario, nome, senha } = await req.json();
    const login = (usuario ?? nome ?? '').trim();

    if (!login || !senha) {
      return NextResponse.json({ error: 'Usuário e senha são obrigatórios.' }, { status: 400 });
    }

    // No schema/cadastro atual o campo é "nome"
    const op = await prisma.operador.findFirst({
      where: { nome: login },
      select: { id: true, nome: true, senha: true },
    });

    if (!op) {
      return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 });
    }

    // Se a senha no banco estiver hasheada ($2a/$2b/$2y), usa bcrypt; senão, compara texto.
    const isHash = typeof op.senha === 'string' && /^\$2[aby]\$/.test(op.senha);
    const ok = isHash ? await bcrypt.compare(senha, op.senha) : senha === op.senha;

    if (!ok) {
      return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 });
    }

    // Seta cookie de sessão simples (middleware só checa presença do cookie)
    const res = NextResponse.json({ id: op.id, nome: op.nome });
    res.cookies.set('token', 'ok', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8h
    });
    return res;
  } catch (e) {
    console.error('POST /api/login', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
