// middleware.js
import { NextResponse } from 'next/server';

const PUBLIC_FILES = new Set([
  '/pagamento.html',
  '/favicon.ico',
]);

const PUBLIC_PREFIXES = [
  '/captive',   // CSS/JS do captive
  '/assets',    // imagens/fontes
  '/_next',     // arquivos internos do Next
  '/login',     // tela de login
];

const PUBLIC_APIS = [
  '/api/pagamento',
  '/api/verificar-pagamento',
  '/api/liberar-acesso',
  '/api/pix-webhook',
];

export function middleware(req) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get('token')?.value;

  // 1) Arquivos e caminhos públicos (HTML estático, assets, _next, login)
  if (PUBLIC_FILES.has(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2) APIs
  if (pathname.startsWith('/api')) {
    // Preflight CORS → deixa passar
    if (req.method === 'OPTIONS') return NextResponse.next();

    // APIs públicas do captive
    if (PUBLIC_APIS.some(p => pathname.startsWith(p))) {
      return NextResponse.next();
    }

    // Demais APIs exigem token
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 3) Páginas (App Router)
  // login é público
  if (pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  // páginas protegidas (dashboard etc.)
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Rodar em tudo, exceto estáticos óbvios
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|captive/).*)',
  ],
};
