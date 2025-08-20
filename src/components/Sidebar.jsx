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
  Server
} from 'lucide-react';

const COLORS = {
  // mesma paleta do captive
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

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth() || {};

  const isActive = (href) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-64 flex flex-col justify-between"
      style={{
        // cor do captive
        background: `linear-gradient(180deg, ${COLORS.sidebar} 0%, ${COLORS.sidebar2} 100%)`,
        color: COLORS.text,
        fontFamily: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        boxShadow: '2px 0 12px rgba(0,0,0,0.10)',
        borderRight: `1px solid ${COLORS.border}`,
      }}
    >
      {/* conteúdo */}
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
              >
                <Icon size={22} />
                <span style={{ fontWeight: 600 }}>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* rodapé do sidebar */}
      <div
        className="px-4 pt-3 pb-5"
        style={{ borderTop: `1px solid ${COLORS.divider}` }}  // sem linha forte branca
      >
        <button
          onClick={() => logout?.()}
          className="w-full py-2 rounded-lg font-semibold transition-colors"
          style={{
            background: COLORS.btn,
            color: COLORS.text,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.btn)}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
