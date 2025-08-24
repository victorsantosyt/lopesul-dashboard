// src/app/api/pagamentos/route.js
import { NextResponse } from 'next/server';

export async function POST(req) {
  // Redireciona preservando método e body
  const url = new URL('/api/pagamentos/checkout', req.url);
  return NextResponse.redirect(url, 307);
}

// Opcional: documenta que só POST é aceito aqui
export async function GET() {
  return new NextResponse(
    JSON.stringify({
      message:
        'Use POST /api/pagamentos/checkout para criar a cobrança Pix. Este endpoint é um alias/compatibilidade.',
    }),
    {
      status: 405,
      headers: {
        'content-type': 'application/json',
        'allow': 'POST',
      },
    }
  );
}
