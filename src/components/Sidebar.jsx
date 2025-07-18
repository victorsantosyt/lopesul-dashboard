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

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="fixed left-0 top-0 w-64 h-screen bg-blue-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-10">Lopesul Wi-Fi</h1>
      <nav className="flex flex-col gap-4">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80">
          <LayoutDashboard size={20} /> Dashboard
        </Link>
        <Link href="/pagamentos" className="flex items-center gap-3 hover:opacity-80">
          <DollarSign size={20} /> Pagamentos
        </Link>
        <Link href="/relatorios" className="flex items-center gap-3 hover:opacity-80">
          <BarChart2 size={20} /> Relatórios
        </Link>
        <Link href="/acessos" className="flex items-center gap-3 hover:opacity-80">
          <Users size={20} /> Acessos
        </Link>
        <Link href="/frotas" className="flex items-center gap-3 hover:opacity-80">
          <Bus size={20} /> Frotas
        </Link>
        <Link href="/dispositivos" className="flex items-center gap-3 hover:opacity-80">
          <Server size={20} /> Dispositivos
        </Link>
        <Link href="/configuracoes" className="flex items-center gap-3 hover:opacity-80">
          <Settings size={20} /> Configurações
        </Link>
        <Link href="/operadores" className="flex items-center gap-3 hover:opacity-80">
          <UserCog size={20} /> Operadores
        </Link>
      </nav>

      {user && (
        <button
          onClick={logout}
          className="mt-8 bg-red-500 px-4 py-2 rounded hover:bg-red-600"
        >
          Sair
        </button>
      )}
    </aside>
  );
}
