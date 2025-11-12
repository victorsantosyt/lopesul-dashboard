// src/app/api/login/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// topo do arquivo
const DUR = {
  // aceita as duas nomenclaturas
  "30m": 30 * 60,
  "1h":  1  * 60 * 60,
  "3h":  3  * 60 * 60,
  "4h":  4  * 60 * 60,
  "6h":  6  * 60 * 60,
  "8h":  8  * 60 * 60,
  "24h": 24 * 60 * 60,
  "permanente": 100 * 24 * 60 * 60,
  "permanent":  100 * 24 * 60 * 60,
};

// lê default do Config
async function getDefaultSeconds() {
  try {
    const row = await prisma.config.findUnique({ where: { key: 'sessionDefault' }});
    return Number(row?.value) > 0 ? Number(row.value) : (4 * 60 * 60);
  } catch {
    return 4 * 60 * 60;
  }
}

export async function POST(req) {
  try {
    const { usuario, nome, senha, duration } = await req.json();
    const login = (usuario ?? nome ?? '').trim();

    if (!login || !senha) {
      return NextResponse.json({ error: 'Usuário e senha são obrigatórios.' }, { status: 400 });
    }

    const op = await prisma.operador.findFirst({
      where: { nome: login },                 // seu schema usa "nome" mapeado para coluna "usuario"
      select: { id: true, nome: true, senha: true, ativo: true },
    });
    if (!op || op.ativo === false) {
      return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 });
    }

    const isHash = typeof op.senha === 'string' && /^\$2[aby]\$/.test(op.senha);
    const ok = isHash ? await bcrypt.compare(senha, op.senha) : senha === op.senha;
    if (!ok) {
      return NextResponse.json({ error: 'Usuário ou senha inválidos.' }, { status: 401 });
    }

    // escolhe duração: 1) body.duration => DUR[...]  2) default do servidor
  // ...
const pref = req.cookies.get('session_pref')?.value; // '30m' | '1h' | '4h' | '8h' | '24h' | 'permanent'
const chosen =
  (duration && DUR[duration]) ? DUR[duration] :
  (pref && DUR[pref]) ? DUR[pref] :
  await getDefaultSeconds();
// ...


    const res = NextResponse.json({ id: op.id, nome: op.nome });
    res.cookies.set('token', 'ok', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: chosen,
    });
    res.cookies.set('op', encodeURIComponent(op.nome), { path: '/', maxAge: chosen });
    res.cookies.set('is_admin', op.nome.toLowerCase() === 'admin' ? '1' : '0', {
      path: '/',
      maxAge: chosen
    });
    return res;
  } catch (e) {
    console.error('POST /api/login', e);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
