'use client';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function LayoutWrapper({ children }) {
  const pathname = usePathname();
  const hideSidebar = pathname === '/' || pathname === '/login';

  return (
    <div className="flex">
      {!hideSidebar && <Sidebar />}
      <div className={`flex-1 ${!hideSidebar ? 'ml-64' : ''}`}>
        {children}
      </div>
    </div>
  );
}
