'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext'; // Caminho relativo corrigido

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const { usuario, loading } = useAuth();

  useEffect(() => {
    if (!loading && !usuario) {
      router.push('/login');
    }
  }, [usuario, loading, router]);

  if (loading) return <p>Carregando...</p>;

  if (!usuario) return null; // Evita renderizar conteúdo antes do redirect

  return <>{children}</>;
}