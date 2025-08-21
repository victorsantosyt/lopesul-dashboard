"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const DUR_OPTS = [
  { value: "30m",        label: "30 minutos" },
  { value: "1h",         label: "1 hora" },
  { value: "3h",         label: "3 horas" },
  { value: "4h",         label: "4 horas" },
  { value: "6h",         label: "6 horas" },
  { value: "8h",         label: "8 horas" },
  { value: "24h",        label: "24 horas" },
  { value: "permanente", label: "Permanente (~100 dias)" },
];

export default function LoginPage() {
  const [usuario, setUsuario]   = useState("");
  const [senha, setSenha]       = useState("");
  const [duration, setDuration] = useState("4h"); // default visível
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const router = useRouter();
  const search = useSearchParams();

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      // 1) faz login já enviando a duração escolhida
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usuario, senha, duration }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "Falha no login");
      }

      // 2) persiste a preferência (cookie não-HTTPOnly) para próximos logins
      await fetch("/api/auth/session-preference", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ duration }),
      }).catch(() => {});

      const next = search.get("next") || "/dashboard";
      router.replace(next);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F6FA] dark:bg-[#1a2233]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white dark:bg-[#232e47] rounded-xl p-6 shadow space-y-4"
      >
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
          Bem vindo ao Lopesul dashboard
        </h1>

        <div>
          <label className="block text-sm mb-1 dark:text-gray-200">Usuário</label>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm mb-1 dark:text-gray-200">Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm mb-1 dark:text-gray-200">Duração da sessão</label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-[#1a2233] text-gray-800 dark:text-gray-100"
          >
            {DUR_OPTS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {err && <p className="text-sm text-red-500">{err}</p>}

        <button
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-md py-2"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}