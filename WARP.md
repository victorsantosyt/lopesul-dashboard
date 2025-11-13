# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- Next.js app (App Router) for managing Wi‑Fi access on buses, integrating Mikrotik and payments via Pagar.me Pix/Card. Backend uses Prisma with PostgreSQL. TailwindCSS for styling.

Common commands
- Prerequisites: Node >= 18; PostgreSQL connection in DATABASE_URL.
- Install deps
```bash path=null start=null
npm install
```
- Dev server (0.0.0.0:3000)
```bash path=null start=null
npm run dev
```
- Build and start
```bash path=null start=null
npm run build
npm start            # honors $PORT, binds 0.0.0.0
# or
npm run start:local  # 0.0.0.0:3000
```
- Database (Prisma)
```bash path=null start=null
npm run db:push              # create/update schema
npm run db:deploy            # apply migrations in prod
npm run prisma:generate      # regenerate client
npm run studio               # open Prisma Studio (port 5555)
npm run db:seed              # seed demo data (admin user, sample fleet/sales)
```
- Type-check (no tests/lint configured currently)
```bash path=null start=null
npx tsc --noEmit
```

Environment variables (required/used)
- Database: DATABASE_URL (PostgreSQL)
- Mikrotik: MIKROTIK_HOST, MIKROTIK_USER, MIKROTIK_PASS, MIKROTIK_SSL=1|0, PORTA_MIKROTIK (default 8728/8729), MIKROTIK_TIMEOUT_MS
- Relay service (for Mikrotik exec proxy): RELAY_URL or RELAY_BASE
- Pagar.me: PAGARME_SECRET_KEY (required for Pix creation and webhook signature); optional PAGARME_BASE_URL, PAGARME_API_KEY, WEBHOOK_SECRET

Architecture and structure
- Framework and config
  - Next.js 15 (App Router) with alias "@" → "src" (see next.config.mjs). Mixed TS/JS with allowJs=true (see tsconfig.json). Tailwind configured with dark mode class and content scanning across src and public.
  - next.config.mjs sets externals for node-ssh/ssh2 on server build and provides rewrites and cache headers for captive/payment assets.
- Auth and routing
  - middleware.js enforces auth via cookie token, whitelists public assets and APIs, sanitizes the login next param, and guards the rest of the app. Protected client routes additionally use src/components/ProtectedRoute.js to check maintenance mode from /api/configuracoes.
- Data model (Prisma)
  - See prisma/schema.prisma. Key models: Operador (admin user), Frota, Dispositivo, Venda; payment flow with Pedido and Charge, plus SessaoAtiva and WebhookLog. Relationships and indexes defined for operational queries.
- API surface (App Router under src/app/api)
  - Payments: /api/payments/pix (creates Pagar.me order for Pix), /api/payments/card (card order using createCardOrder), webhook handler /api/webhooks/pagarme to update Pedido/Charge and, when paid, triggers Mikrotik access via lib/mikrotik.
  - Dashboard: /api/dashboard aggregates KPIs defensively over available models.
  - Relay proxy: /api/relay/exec forwards commands to an external relay service (RELAY_URL/RELAY_BASE), exposing a thin fetch wrapper in src/lib/relay.ts.
  - Other operational endpoints: dispositivos, frotas, sessoes, configuracoes, db-health, etc., guarded by middleware.
- Mikrotik integration
  - src/lib/mikrotik.(ts|js) reads env via getMikrotikEnv and provides helpers such as liberarClienteNoMikrotik (consumed by webhook). Some sensitive/native deps are excluded from server bundling by next.config.mjs.
- UI
  - App pages under src/app (dashboard, operadores, dispositivos, frotas, pagamentos, etc.). Global providers in src/app/layout.js wire AuthProvider and ThemeProvider. Captive/payment static page lives at public/pagamento.html and is rewritten from /pagamento(s).

Notes for Warp
- No test suite or lint config present; prefer type-check before proposing large refactors.
- Use the "@" alias for imports from src/ to match the project convention.
- Many API routes are dynamic-runtime (export const dynamic='force-dynamic'); prefer no-store fetches when calling them during dev to avoid caching inconsistencies.
