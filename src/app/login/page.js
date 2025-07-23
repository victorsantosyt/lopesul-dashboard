'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault(); // Impede o reload do form
    if (!nome || !senha) {
      setErro('Preencha todos os campos');
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: nome, senha }),
      });

      if (res.ok) {
        const data = await res.json();
        login(data);
        router.push('/dashboard');
      } else {
        setErro('Usuário ou senha inválidos');
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      setErro('Erro de conexão com o servidor');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-[#1a2233] p-4 transition-colors">
      <div className="bg-white dark:bg-[#232e47] shadow-lg rounded-lg p-6 w-full max-w-sm transition-colors">
        <h1 className="text-xl font-bold mb-4 text-center text-gray-800 dark:text-white">
          Bem vindo ao Lopesul dashboard
        </h1>

        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Usuário"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded mb-3 bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded mb-4 bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
          />

          {erro && <p className="text-red-500 text-sm mb-3">{erro}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}