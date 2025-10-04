# Lopesul Dashboard

## Overview

The Lopesul Dashboard is a web-based Wi-Fi access management system for buses, integrating Mikrotik routers with automated Pix payment processing. The system allows passengers to purchase temporary internet access plans (12h, 24h, 48h) with automatic payment validation and network access provisioning.

**Core Purpose**: Manage captive portal authentication, process Pix payments via Pagar.me, and control Mikrotik router access lists to enable/revoke internet access for bus passengers.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### October 04, 2025 - Migration to Replit Complete

**Successfully migrated from Vercel to Replit environment:**

1. **Environment Configuration**:
   - Configured Next.js to run on port 5000 with 0.0.0.0 host binding (required for Replit)
   - Set `allowedOrigins: ['*']` in next.config.mjs to allow Replit proxy access
   - All environment secrets properly configured (DATABASE_URL, PAGARME_SECRET_KEY, MIKROTIK credentials)

2. **Critical Pagar.me API Integration Fixes**:
   - Fixed SSL issue: Internal API calls now use HTTP to localhost in development, configurable for production
   - Added missing Basic Auth encoding for Pagar.me API (`Authorization: Basic ${base64(secretKey:)}`)
   - Added required customer fields: email and mobile_phone (currently using placeholder values)
   - **Important**: Frontend currently doesn't collect email/phone. These use placeholder values:
     - Email: `cliente@lopesul.com.br`
     - Phone: `55 11 999999999`
   - **TODO**: Update frontend (pagamento.html) to collect real customer email and phone for compliance

3. **Production Compatibility**:
   - Internal API calls now use environment-aware base URL
   - Development: `http://localhost:5000`
   - Production: Derives from request URL
   - Proper error handling and logging without exposing secrets

**PIX Payment Flow Status**: ✅ Working end-to-end
- QR codes generate successfully
- Payment webhook ready for integration
- Session management and Mikrotik access control ready

## System Architecture

### Frontend Architecture

- **Framework**: Next.js 15.3.4 with App Router (React 18.2.0)
- **Styling**: Tailwind CSS with custom dark mode support
- **UI Components**: Client-side components with server-side rendering for initial load
- **State Management**: React Context API (AuthContext, ThemeContext)
- **Charts**: ECharts via echarts-for-react for analytics dashboards
- **Routing**: File-based routing with middleware-based authentication and access control

**Design Pattern**: The application uses a hybrid rendering approach - server components for data fetching and SEO, client components for interactivity. Authentication is enforced via middleware that checks HTTP-only cookies before allowing access to protected routes.

### Backend Architecture

- **Runtime**: Node.js (>=18) with Next.js API Routes
- **ORM**: Prisma Client for type-safe database access
- **Database**: PostgreSQL (designed for Railway deployment)
- **Authentication**: Session-based with bcrypt password hashing, configurable session durations (30m to permanent)
- **API Layer**: RESTful endpoints under `/api/*` for CRUD operations and integrations

**Key Architectural Decisions**:

1. **Session Management**: Cookie-based authentication with configurable expiration (stored in Config table). Sessions can be 30 minutes, 1-8 hours, 24 hours, or permanent (100 days). Admin status tracked via separate cookie.

2. **Access Control**: Middleware validates authentication token and maintenance mode before routing. Public paths (captive portal, login, assets) bypass authentication. Admin-only routes check `is_admin` cookie.

3. **Database Schema Design**:
   - `Pagamento` (Payment): Tracks Pix transactions with status (pago/pendente/expirado), amount in cents, external PSP reference
   - `SessaoAtiva` (Active Session): Maps IP/MAC to access duration and expiration
   - `Operador` (Operator): Admin users with bcrypt-hashed passwords
   - `Frota` (Fleet): Groups buses for revenue tracking
   - `Dispositivo` (Device): Individual bus routers
   - `Config`: Key-value store for system settings (maintenance mode, session defaults)

4. **Payment Flow**: 
   - Client requests checkout → Generate Pix QR code via Pagar.me
   - Webhook receives payment confirmation → Update payment status
   - Scheduler creates SessaoAtiva record → Liberates access on Mikrotik
   - Auto-expiration via scheduled task that revokes expired sessions

### External Dependencies

**Payment Service Provider (Pagar.me)**:
- Base URL: `https://api.pagar.me/core/v5`
- Authentication: Basic auth with secret key
- Purpose: Generate Pix QR codes, process card payments, webhook notifications
- Integration: `src/lib/pagarme.js` handles API communication with signature verification

**Mikrotik Router Integration**:
- Protocols: RouterOS API (port 8728/8729 for TLS), SSH (port 22)
- Libraries: `routeros-client`, `node-ssh`, `mikronode-ng`
- Purpose: Add/remove IPs from firewall address lists, monitor PPP connections, check Starlink uplink
- Access Control: Uses address list (default: `paid_clients`) to allow internet access
- Operations:
  - `liberarAcesso()`: Adds IP to allow list
  - `revogarAcesso()`: Removes IP from allow list
  - `listPppActive()`: Gets active PPP sessions
  - SSH ping/monitoring: Validates router connectivity and WAN status

**Environment Configuration**:
- `DATABASE_URL`: PostgreSQL connection string
- `PAGARME_SECRET_KEY`: Payment gateway authentication
- `MIKROTIK_HOST/USER/PASS`: Router API credentials
- `MIKROTIK_SSL/PORT`: API connection settings
- `MIKROTIK_PAID_LIST`: Firewall address list name
- `APP_URL`: Base URL for webhook callbacks

**Deployment Targets**:
- Primary: Railway (automated migrations via `prisma migrate deploy`)
- Alternative: Vercel, other Node.js platforms
- Port: 5000 (configurable)
- Build: `next build` with automatic Prisma client generation

**Scheduled Tasks**:
- Payment expiration: Marks pending payments as expired after timeout
- Session provisioning: Creates SessaoAtiva for paid payments without sessions
- Access revocation: Removes Mikrotik access for expired sessions
- Implementation: `src/lib/scheduler.js` (requires external cron/worker trigger)

**Security Measures**:
- Password hashing: bcrypt with salt rounds = 10
- CSRF protection: SameSite cookies
- Webhook signature verification: HMAC SHA1 validation
- Input sanitization: IP/MAC address validation, SQL injection prevention via Prisma
- Rate limiting: Configurable timeouts for external API calls (2-10 seconds)