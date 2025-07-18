'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [expiraEm, setExpiraEm] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const usuarioSalvo = localStorage.getItem('usuario');
    const expiraEmSalvo = localStorage.getItem('expiraEm');

    if (usuarioSalvo && expiraEmSalvo) {
      const agora = new Date().getTime();
      if (agora < parseInt(expiraEmSalvo)) {
        setUsuario(JSON.parse(usuarioSalvo));
        setExpiraEm(parseInt(expiraEmSalvo));
      } else {
        logout();
      }
    }
    setLoading(false); // Garante que o loading será atualizado
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!expiraEm) return;
    const intervalo = setInterval(() => {
      const agora = new Date().getTime();
      if (expiraEm && agora >= expiraEm) {
        alert('Sua sessão expirou. Faça login novamente.');
        logout();
      }
    }, 1000);

    return () => clearInterval(intervalo);
    // eslint-disable-next-line
  }, [expiraEm]);

  function login(dadosUsuario) {
    setUsuario(dadosUsuario);
    const tempoMinutos = localStorage.getItem('tempoSessao') || 15;
    const tempoSessao = parseInt(tempoMinutos) * 60 * 1000;
    const agora = new Date().getTime();
    const expira = agora + tempoSessao;

    setExpiraEm(expira);
    localStorage.setItem('usuario', JSON.stringify(dadosUsuario));
    localStorage.setItem('expiraEm', expira);
  }

  function logout() {
    setUsuario(null);
    setExpiraEm(null);
    localStorage.removeItem('usuario');
    localStorage.removeItem('expiraEm');
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}