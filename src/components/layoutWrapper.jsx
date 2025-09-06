'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();
  const hideSidebar = pathname === '/' || pathname === '/login';
  const [open, setOpen] = useState(false);

  // Páginas sem sidebar (login/landing)
  if (hideSidebar) {
    return (
      <div className="min-h-screen bg-[#F0F6FA] dark:bg-[#1a2233]">
        <main className="p-6 lg:p-8">
          <div className="overflow-x-auto">{children}</div>
        </main>
      </div>
    );
  }

  // Páginas com sidebar
  return (
    <div className="relative min-h-screen bg-[#F0F6FA] dark:bg-[#1a2233]">
      {/* Sidebar: fixo no desktop, drawer no mobile */}
      <Sidebar open={open} onClose={() => setOpen(false)} />

      {/* Topbar (aparece só no mobile) */}
      <header
        className="
          lg:hidden sticky top-0 z-40
          bg-[#1a2233]/80 backdrop-blur
          border-b border-white/10
          px-3 py-3 flex items-center gap-3 text-slate-100
        "
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-2 hover:bg-white/10"
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="font-semibold">Painel</span>
      </header>

      {/* Área principal:
          - no desktop reservamos 256px pro sidebar com lg:pl-64
          - no mobile ocupa 100% (drawer sobrepõe quando aberto)
      */}
      <main className="lg:pl-64">
        <div className="p-4 lg:p-8">
          {/* Protege contra estouro horizontal em tabelas/grids */}
          <div className="overflow-x-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
