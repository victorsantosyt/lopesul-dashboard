'use client';
import Link from 'next/link';
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
  bg: 'rgb(0,34,68)', // azul escuro
  bgHover: 'rgb(0,51,102)', // azul médio
  text: 'rgb(255,255,255)', // branco
  textSecondary: 'rgb(255,255,255)', // branco
  divider: 'rgb(224,224,224)', // cinza claro
  button: 'rgb(0,200,83)', // verde destaque
  buttonHover: 'rgb(0,150,36)', // verde escuro
  border: 'rgb(33,55,96)', // azul borda lateral
  topBar: 'rgb(33,55,96)', // azul barra superior
};

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pagamentos', label: 'Pagamentos', icon: DollarSign },
  { href: '/relatorios', label: 'Análises', icon: BarChart2 },
  { href: '/acessos', label: 'Acessos', icon: Users },
  { href: '/frotas', label: 'Frotas', icon: Bus },
  { href: '/dispositivos', label: 'Dispositivos', icon: Server },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
  { href: '/operadores', label: 'Operadores', icon: UserCog },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside
      className="fixed left-0 top-0 w-64 h-screen flex flex-col justify-between"
      style={{
        background: `linear-gradient(180deg, ${COLORS.bg} 80%, rgb(0, 51, 100) 100%)`,
        color: COLORS.text,
        fontFamily: "'Inter', sans-serif",
        boxShadow: '2px 0 12px 0 rgba(0,0,0,0.00)',
        borderLeft: `2px solid ${COLORS.border}`, // Borda lateral no sidebar inteiro!
      }}
    >
      {/* Barra superior: preenche 100% */}
      <div
        style={{
          width: '100%',
          height: '48px',
          background: COLORS.topBar,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: COLORS.text,
            fontWeight: 800,
            fontSize: '1.25rem',
            letterSpacing: '-1px',
            textAlign: 'center',
            width: '100%',
          }}
        >
          Lopesul <span style={{ color: COLORS.textSecondary }}>Dashboard</span>
        </span>
      </div>

      {/* Conteúdo do sidebar */}
      <div className="flex-1 flex flex-col justify-between pb-6 pt-8 px-4">
        <nav className="flex flex-col gap-2">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group"
              style={{
                color: COLORS.text,
                fontWeight: 500,
                fontSize: '1rem',
              }}
            >
              <Icon size={24} className="transition-all duration-200 group-hover:scale-110" />
              <span className="group-hover:text-blue-200">{label}</span>
              <style jsx>{`
                a:hover, a:focus {
                  background: ${COLORS.bgHover};
                  color: ${COLORS.text};
                }
              `}</style>
            </Link>
          ))}
        </nav>
      </div>

      <div className="px-4 pb-6">
        <div
          style={{
            borderTop: `1px solid ${COLORS.divider}`,
            margin: '2rem 0 1rem 0',
          }}
        >
          {/* botão sair */}
        </div>
        {user && (
          <button
            onClick={logout}
            className="w-full py-2 rounded-lg font-semibold transition-all duration-200"
            style={{
              background: COLORS.button,
              color: COLORS.text,
              boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)',
            }}
            onMouseOver={e => (e.currentTarget.style.background = COLORS.buttonHover)}
            onMouseOut={e => (e.currentTarget.style.background = COLORS.button)}
          >
            Sair
          </button>
        )}
      </div>
    </aside>
  );
}
