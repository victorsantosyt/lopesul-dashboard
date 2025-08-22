"use client";

import { useState, useEffect } from "react";

function getNextPath() {
  if (typeof window === "undefined") return "/dashboard";
  const sp = new URLSearchParams(window.location.search);
  return sp.get("next") || "/dashboard";
}

export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  
  async function onSubmit(e) {
    e.preventDefault();
    if (!usuario || !senha) {
      alert("Informe usuário e senha.");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usuario, senha }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j?.error || "Falha ao entrar.");
        return;
      }
      window.location.href = getNextPath();
    } catch (err) {
      console.error(err);
      alert("Erro de rede ao entrar.");
    } finally {
       setLoading(false);
    }

  }

  useEffect(() => {
    try { localStorage.removeItem("expiraEm"); } catch {}
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-transparent">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-slate-800/90 ring-1 ring-inset ring-white/10 shadow-xl px-6 py-6 space-y-4 backdrop-blur-sm transition-colors"
      >
        <h1 className="text-2xl font-bold">Olá Operador</h1>

        <div className="space-y-1">
          <label className="text-sm text-slate-300">Usuário</label>
          <input
            className="w-full rounded-lg px-4 py-2 bg-slate-900/40 text-slate-100
                       border border-white/10 placeholder-slate-400 outline-none
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="Usuário"
            autoComplete="username"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-300">Senha</label>
          <input
            className="w-full rounded-lg px-4 py-2 bg-slate-900/40 text-slate-100
                       border border-white/10 placeholder-slate-400 outline-none
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="Senha"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}