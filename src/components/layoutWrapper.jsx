'use client';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();
  const hideSidebar = pathname === '/' || pathname === '/login';

  return (
    <div className="flex min-h-screen bg-[#F0F6FA] dark:bg-[#1a2233] transition-colors">
      {!hideSidebar && <Sidebar />}
      <main
        className={`
          flex-1
          transition-all
          ${!hideSidebar ? 'ml-64' : ''}
          p-8
          bg-[#F0F6FA]
          dark:bg-[#1a2233]
        `}
      >
        {children}
      </main>
    </div>
  );
}
