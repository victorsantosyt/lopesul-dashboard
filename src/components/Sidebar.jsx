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
  LogOut,
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
  btnHover: 'rgba(188, 35, 30, 0.99)',
};

const navLinks = [
  { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/pagamentos',    label: 'Pagamentos',    icon: DollarSign },
  { href: '/relatorios',    label: 'Relatórios',    icon: BarChart2 },
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
        className={`fixed inset-0 z-40 bg-black/40 lg:hidden transition-opacity ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!open}
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-50 h-screen flex flex-col justify-between
          transition-transform duration-300 will-change-transform
          w-16 lg:w-64
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
        style={{
          background: `linear-gradient(180deg, ${COLORS.sidebar} 0%, ${COLORS.sidebar2} 100%)`,
          color: COLORS.text,
          fontFamily:
            "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          boxShadow: '2px 0 12px rgba(0,0,0,0.10)',
          borderRight: `1px solid ${COLORS.border}`,
        }}
        role="navigation"
        aria-label="Menu lateral"
      >
        {/* Cabeçalho (apenas mobile/tablet) */}
        <div
          className="lg:hidden flex items-center justify-between px-3 h-14 border-b"
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
        <div className="flex-1 overflow-y-auto px-2 lg:px-4 pt-4 lg:pt-6 pb-3 lg:pb-4">
          <nav className="flex flex-col gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}              // tooltip quando estiver só com ícones
                  aria-label={label}
                  className="flex items-center gap-3 px-2 lg:px-3 py-2 rounded-lg transition-colors"
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
                  onClick={onClose}
                >
                  <Icon size={22} className="shrink-0" />
                  {/* rótulo oculto em telas pequenas */}
                  <span className="hidden lg:inline font-semibold truncate">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Rodapé */}
        <div
          className="px-2 lg:px-4 pt-2 pb-4"
          style={{ borderTop: `1px solid ${COLORS.divider}` }}
        >
          <button
            onClick={() => {
              onClose();
              logout?.();
            }}
            className="w-full flex items-center justify-center lg:justify-start gap-3 py-2 rounded-lg font-semibold transition-colors"
            style={{ background: COLORS.btn, color: COLORS.text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.btn)}
            title="Sair"
            aria-label="Sair"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="hidden lg:inline">Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
