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
  '/api/pagamentos/checkout',
  '/api/payments',
  // compat/legado
  '/api/pagamentos',
  '/api/pagamentos/pix',
  '/api/pagamento',
  '/api/verificar-pagamento',
  '/api/liberar-acesso',

  // === auth / config públicas ===
  '/api/pix-webhook',
  '/api/auth/session-preference',
  '/api/configuracoes',
  '/api/login',
  '/api/logout',
];

// ✅ Whitelist de destinos pós-login (adicione novas páginas aqui quando surgirem)
const ALLOWED_NEXT_PATHS = new Set([
  '/',
  '/dashboard',
  '/operadores',
  '/configuracoes',
  '/dispositivos',
  '/frotas',
]);

// Cabeçalhos básicos de endurecimento (não quebram inline scripts)
function withStdHeaders(res) {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  return res;
}

// Normaliza/clampa o "next" do /login
function normalizeNext(raw, origin) {
  try {
    if (!raw) return '/dashboard';

    const decoded = decodeURIComponent(raw.trim());
    // Bloqueia esquemas perigosos
    if (/^\s*(javascript|data):/i.test(decoded)) return '/dashboard';

    const u = new URL(decoded, origin);

    // Só mesma origem
    if (u.origin !== origin) return '/dashboard';

    // Nunca redirecionar para /api
    if (u.pathname.startsWith('/api')) return '/dashboard';

    // Só permite paths whitelisted
    if (!ALLOWED_NEXT_PATHS.has(u.pathname)) return '/dashboard';

    // Retorna caminho + query + hash
    return (u.pathname + u.search + u.hash) || '/dashboard';
  } catch {
    return '/dashboard';
  }
}

export function middleware(req) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get('token')?.value;

  // 1) Arquivos/caminhos públicos
  if (
    PUBLIC_FILES.has(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return withStdHeaders(NextResponse.next());
  }

  // 2) APIs
  if (pathname.startsWith('/api')) {
    // Preflight CORS
    if (req.method === 'OPTIONS') return withStdHeaders(NextResponse.next());

    // APIs liberadas (prefix match seguro)
    if (PUBLIC_APIS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      return withStdHeaders(NextResponse.next());
    }

    // Demais APIs exigem token
    if (!token) {
      const res = NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
      return withStdHeaders(res);
    }
    return withStdHeaders(NextResponse.next());
  }

  // 3) Página de login — clamp do "next"
  if (pathname.startsWith('/login')) {
    const url = req.nextUrl.clone();
    const originalNext = url.searchParams.get('next');
    const safe = normalizeNext(originalNext, url.origin);
    if (safe && safe !== originalNext) {
      url.searchParams.set('next', safe);
      return withStdHeaders(NextResponse.redirect(url));
    }
    return withStdHeaders(NextResponse.next());
  }

  // Garante que a página do captive passa sempre
  if (pathname === '/pagamento.html') {
    return withStdHeaders(NextResponse.next());
  }

  // 4) Protege o restante do app
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    // "next" sempre interno (path atual + query)
    url.searchParams.set('next', pathname + (search || ''));
    return withStdHeaders(NextResponse.redirect(url));
  }

  return withStdHeaders(NextResponse.next());
}

// Evita rodar em estáticos óbvios
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|captive/).*)',
  ],
};
