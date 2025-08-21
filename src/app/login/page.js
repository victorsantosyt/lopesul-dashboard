"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// evita pre-render no build e garante render em runtime
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DUR_OPTIONS = [
  { key: "3h", label: "3 horas" },
  { key: "4h", label: "4 horas" },
  { key: "6h", label: "6 horas" },
  { key: "24h", label: "24 horas" },
  { key: "permanente", label: "Permanente (~100 dias)" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams(); // <- OK aqui porque está dentro de Suspense (ver export default)
  const next = params.get("next") || "/dashboard";

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [duration, setDuration] = useState("4h");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usuario, senha, duration }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Falha no login");
      // opcional: guardar nome do usuário localmente
      localStorage.setItem("usuario", JSON.stringify(j));
      router.replace(next);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[#F0F6FA] dark:bg-[#1a2233]">
      <form onSubmit={onSubmit} className="bg-white dark:bg-[#232e47] shadow rounded-xl p-6 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Entrar</h1>

        {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

        <label className="block text-sm text-gray-700 dark:text-gray-200 mb-1">Usuário</label>
        <input
          className="w-full mb-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#1a2233] text-gray-900 dark:text-gray-100"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          placeholder="admin"
          autoComplete="username"
        />

        <label className="block text-sm text-gray-700 dark:text-gray-200 mb-1">Senha</label>
        <input
          type="password"
          className="w-full mb-4 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#1a2233] text-gray-900 dark:text-gray-100"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />

        <label className="block text-sm text-gray-700 dark:text-gray-200 mb-1">Duração da sessão</label>
        <select
          className="w-full mb-4 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#1a2233] text-gray-900 dark:text-gray-100"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        >
          {DUR_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function Page() {
  // **AQUI** envolvemos o componente que usa useSearchParams em Suspense
  return (
    <Suspense fallback={<div className="p-8">Carregando…</div>}>
      <LoginForm />
    </Suspense>
  );
}