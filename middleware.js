// middleware.js
import { NextResponse } from 'next/server';

// === arquivos públicos (sem auth)
const PUBLIC_FILES = new Set([
  '/pagamento.html', // página do captive (frontend do QR)
  '/favicon.ico',
]);

// === prefixos públicos (assets, next, login)
const PUBLIC_PREFIXES = [
  '/captive',   // CSS/JS do captive
  '/assets',    // imagens/fontes
  '/_next',     // internos do Next
  '/login',     // tela de login
];

// === APIs públicas (usadas por captive/pagamentos/health)
const PUBLIC_APIS = [
  '/api/db-health',
  '/api/relay/ping',

  // pagamentos/captive
  '/api/pagamentos/checkout',
  '/api/pagamentos',         // compat/legado (lista/consulta)
  '/api/pagamentos/pix',     // compat/legado (gera PIX)
  '/api/pagamento',          // compat/legado
  '/api/payments',           // nova base
  '/api/payments/pix',
  '/api/verificar-pagamento',
  '/api/liberar-acesso',
  '/api/debug/pagarme',      // diagnóstico de ambiente/pagamentos

  // comando indireto via backend -> relay (deixa público p/ captive)
  '/api/command/exec',

  // mikrotik utilities
  '/api/mikrotik/upload-redirect',
  '/api/mikrotik/arp',

  // auth/config leves
  '/api/auth/session-preference',
  '/api/configuracoes',
  '/api/login',
  '/api/logout',
];

// ✅ destinos pós-login permitidos
const ALLOWED_NEXT_PATHS = new Set([
  '/',
  '/dashboard',
  '/operadores',
  '/configuracoes',
  '/dispositivos',
  '/frotas',
]);

function withStdHeaders(res) {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  return res;
}

function normalizeNext(raw, origin) {
  try {
    if (!raw) return '/dashboard';
    const decoded = decodeURIComponent(raw.trim());

    // bloqueia esquemas perigosos
    if (/^\s*(javascript|data):/i.test(decoded)) return '/dashboard';

    const u = new URL(decoded, origin);
    if (u.origin !== origin) return '/dashboard';      // mesma origem
    if (u.pathname.startsWith('/api')) return '/dashboard'; // nunca p/ /api
    if (!ALLOWED_NEXT_PATHS.has(u.pathname)) return '/dashboard';

    return (u.pathname + u.search + u.hash) || '/dashboard';
  } catch {
    return '/dashboard';
  }
}

export function middleware(req) {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get('token')?.value;

  // --- FAST-PASS: health sempre liberado (evita qualquer interferência)
  if (pathname === '/api/db-health') {
    return withStdHeaders(NextResponse.next());
  }

  // /pagamento.html é público - segurança via validação de parâmetros Mikrotik no backend

  // 1) Arquivos/caminhos públicos
  if (
    PUBLIC_FILES.has(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return withStdHeaders(NextResponse.next());
  }

  // 2) APIs
  if (pathname.startsWith('/api')) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return withStdHeaders(NextResponse.next());
    }

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

  // 4) Protege o restante do app
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + (search || ''));
    return withStdHeaders(NextResponse.redirect(url));
  }

  return withStdHeaders(NextResponse.next());
}

// Evita rodar apenas em estáticos do Next.js
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|captive/).*)',
  ],
};
