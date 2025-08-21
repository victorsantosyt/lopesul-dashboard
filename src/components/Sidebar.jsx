'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  DollarSign,
  Users,
  Bus,
  BarChart2,
  Settings,
  UserCog,
  Server,
} from 'lucide-react';

const COLORS = {
  sidebar: '#213760',
  sidebar2: '#1A2F53',
  text: '#ffffff',
  textDim: 'rgba(255,255,255,0.85)',
  hoverBg: 'rgba(255,255,255,0.08)',
  activeBg: 'rgba(255,255,255,0.12)',
  divider: 'rgba(255,255,255,0.12)',
  border: 'rgba(0,0,0,0.25)',
  btn: 'rgba(30, 77, 188, 0.99)',
  btnHover: '#529737',
};

const navLinks = [
  { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/pagamentos',    label: 'Pagamentos',    icon: DollarSign },
  { href: '/relatorios',    label: 'Análises',      icon: BarChart2 },
  { href: '/acessos',       label: 'Acessos',       icon: Users },
  { href: '/frotas',        label: 'Frotas',        icon: Bus },
  { href: '/dispositivos',  label: 'Dispositivos',  icon: Server },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
  { href: '/operadores',    label: 'Operadores',    icon: UserCog },
];

/**
 * Props:
 * - open?: boolean (controle do drawer no mobile)
 * - onClose?: () => void  (fechar drawer no mobile)
 */
export default function Sidebar({ open = false, onClose = () => {} }) {
  const pathname = usePathname();
  const { logout } = useAuth() || {};
  const isActive = (href) => pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <>
      {/* Overlay (mobile) */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      />

      {/* Drawer / Lateral */}
      <aside
        className={`
          fixed left-0 top-0 z-50 h-screen w-64 flex flex-col justify-between
          transition-transform duration-300 will-change-transform
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
        style={{
          background: `linear-gradient(180deg, ${COLORS.sidebar} 0%, ${COLORS.sidebar2} 100%)`,
          color: COLORS.text,
          fontFamily:
            "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          boxShadow: '2px 0 12px rgba(0,0,0,0.10)',
          borderRight: `1px solid ${COLORS.border}`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Menu lateral"
      >
        {/* Cabeçalho do menu (apenas mobile) */}
        <div
          className="md:hidden flex items-center justify-between px-4 h-14 border-b"
          style={{ borderColor: COLORS.divider }}
        >
          <span className="font-semibold">Menu</span>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="rounded p-2 hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-4">
          <nav className="flex flex-col gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
                  style={{
                    background: active ? COLORS.activeBg : 'transparent',
                    color: COLORS.textDim,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = COLORS.hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={onClose /* fecha o drawer ao navegar no mobile */}
                >
                  <Icon size={22} />
                  <span style={{ fontWeight: 600 }}>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Rodapé */}
        <div
          className="px-4 pt-3 pb-5"
          style={{ borderTop: `1px solid ${COLORS.divider}` }}
        >
          <button
            onClick={() => {
              onClose();
              logout?.();
            }}
            className="w-full py-2 rounded-lg font-semibold transition-colors"
            style={{ background: COLORS.btn, color: COLORS.text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.btn)}
          >
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
