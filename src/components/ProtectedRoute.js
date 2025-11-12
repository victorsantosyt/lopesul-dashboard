'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function ProtectedRoute({ children }) {
  const [ok, setOk] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      // precisa estar logado (middleware já força isso via cookie 'token')
      // checa manutenção
      try {
        const cfg = await fetch('/api/configuracoes', { cache: 'no-store' }).then(r => r.json());
        const maint = !!cfg?.maintenance;

        // simples: admin via cookie
        const isAdmin = typeof document !== 'undefined' && document.cookie.includes('is_admin=1');

        if (maint && !isAdmin && pathname !== '/manutencao') {
          router.replace('/manutencao');
          return;
        }
        setOk(true);
      } catch {
        setOk(true); // não travar se API falhar
      }
    })();
  }, [router, pathname]);

  if (!ok) return null;
  return children;
}
