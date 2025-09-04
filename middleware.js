// middleware.js
import { NextResponse } from 'next/server';

const PUBLIC_FILES = new Set([
  '/pagamento.html',  // página do captive (frontend do QR)
  '/favicon.ico',
]);

const PUBLIC_PREFIXES = [
  '/captive',  // CSS/JS do captive
  '/assets',   // imagens/fontes
  '/_next',    // arquivos internos do Next
  '/login',    // tela de login
];

const PUBLIC_APIS = [
  // === APIs do captive / pagamentos ===
  '/api/pagamentos/checkout',   // cria checkout (reais -> chama /api/payments/pix)
  '/api/payments',              // cobre /api/payments/pix e /api/payments/[id]/...
  // compat/legado, se ainda existirem:
  '/api/pagamentos',            // fallback de rotas antigas sob /api/pagamentos
  '/api/pagamentos/pix',        // compat antigo (se houver)
  '/api/pagamento',             // legado (singular)
  '/api/verificar-pagamento',   // legado
  '/api/liberar-acesso',        // usado no captive

  // === auth / config públicas ===
  '/api/pix-webhook',           // quando ativar o webhook
  '/api/auth/session-preference',
  '/api/configuracoes',
  '/api/login',                 // público para logar
  '/api/logout',
];

export function middleware(req) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get('token')?.value;

  // 1) Arquivos/caminhos públicos (estáticos e páginas liberadas)
  if (PUBLIC_FILES.has(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2) APIs
  if (pathname.startsWith('/api')) {
    // Preflight CORS
    if (req.method === 'OPTIONS') return NextResponse.next();

    // APIs liberadas (prefix match)
    if (PUBLIC_APIS.some(p => pathname.startsWith(p))) {
      return NextResponse.next();
    }

    // Demais APIs exigem token
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 3) Páginas
  if (pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  // Garante que a página do captive passa sempre
  if (pathname === '/pagamento.html') {
    return NextResponse.next();
  }

  // Protege o restante do app
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Evita rodar em estáticos óbvios
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|captive/).*)',
  ],
};
