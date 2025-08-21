"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function iso(d) { return new Date(d).toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtTempo(min) {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = Math.max(0, Math.round(min - h * 60));
  if (h <= 0) return `${m} min`;
  if (m <= 0) return `${h} h`;
  return `${h} h ${m} min`;
}
function diffMin(a, b) { return (a - b) / 60000; } // minutos

export default function AcessosPage() {
  const [range, setRange] = useState("24h"); // 24h | hoje | semana | mes
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const now = useMemo(() => new Date(), []);
  const { from, to } = useMemo(() => {
    const t = new Date();
    let f = addDays(t, -1);
    switch (range) {
      case "hoje": {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        f = start; break;
      }
      case "semana": f = addDays(t, -7); break;
      case "mes": f = addDays(t, -30); break;
      default: f = addDays(t, -1);
    }
    return { from: f, to: t };
  }, [range]);

  const fetchingRef = useRef(false);

  async function loadData(signal) {
    try {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setLoading(true);
      const url = `/api/sessoes?from=${iso(from)}&to=${iso(to)}`;
      const res = await fetch(url, { cache: "no-store", signal });
      const data = await res.json();

      // Esperado da API: [{ id, ipCliente, macCliente, plano, inicioEm, expiraEm, ativo, nome? }]
      if (Array.isArray(data)) {
        const nowLocal = new Date();
        const mapped = data.map((s) => {
          const inicio = s.inicioEm ? new Date(s.inicioEm) : null;
          const expira = s.expiraEm ? new Date(s.expiraEm) : null;
          const ativo = !!s.ativo && (!expira || expira > nowLocal);
          const tempoMin = inicio ? diffMin(nowLocal, inicio) : null;
          return {
            id: s.id,
            nome: s.nome || s.macCliente || s.ipCliente || "—",
            ip: `${s.ipCliente || "—"}${s.macCliente ? ` / ${s.macCliente}` : ""}`,
            plano: s.plano || "—",
            tempo: ativo && tempoMin != null ? fmtTempo(tempoMin) : "—",
            status: ativo ? "Ativo" : (expira && expira <= nowLocal ? "Expirado" : "Inativo"),
          };
        });
        setRows(mapped);
        setLastUpdated(new Date());
      } else {
        setRows([]);
      }
    } catch (e) {
      if (e?.name !== "AbortError") {
        console.error("Erro ao carregar sessões:", e);
        setRows([]);
      }
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }

  // primeira carga + recarga quando range muda
  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const controller = new AbortController();
    const iv = setInterval(() => loadData(controller.signal), 15000); // 15s
    return () => { controller.abort(); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, from, to]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r =>
      r.nome.toLowerCase().includes(term) ||
      r.ip.toLowerCase().includes(term) ||
      r.plano.toLowerCase().includes(term)
    );
  }, [rows, q]);

  async function encerrar(id) {
    if (!confirm("Encerrar esta sessão agora?")) return;
    try {
      const res = await fetch(`/api/sessoes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao encerrar");
      // feedback otimista
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: "Inativo", tempo: "—" } : r));
    } catch (e) {
      console.error(e);
      alert("Não foi possível encerrar a sessão. Verifique a rota /api/sessoes/:id (DELETE).");
    }
  }

  function exportCSV() {
    const header = ["Nome", "IP / MAC", "Plano", "Tempo conectado", "Status"];
    const lines = filtered.map(r => [r.nome, r.ip, r.plano, r.tempo, r.status]);
    const csv = [header, ...lines].map(a =>
      a.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `acessos_${iso(from)}_${iso(to)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 md:p-8 bg-[#F0F6FA] dark:bg-[#1a2233] min-h-screen transition-colors">
      <div className="bg-white dark:bg-[#232e47] rounded-xl p-6 shadow">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Acompanhamento de Acessos
          </h1>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (15s)
            </label>
            <span>•</span>
            <span>
              {lastUpdated ? `Atualizado: ${lastUpdated.toLocaleTimeString()}` : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-4">
        <input
          type="text"
          placeholder="Buscar por nome, IP ou plano"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md w-full md:w-1/3 bg-white dark:bg-[#232e47] text-gray-800 dark:text-gray-100"
        />
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#232e47] text-gray-800 dark:text-gray-100"
        >
          <option value="24h">Últimas 24h</option>
          <option value="hoje">Hoje</option>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mês</option>
        </select>
        <button onClick={exportCSV} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md">
          Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl shadow bg-white dark:bg-[#232e47] transition-colors">
        <table className="min-w-full text-sm text-left text-gray-700 dark:text-gray-200">
          <thead className="bg-gray-100 dark:bg-[#1a2233] text-gray-700 dark:text-gray-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">IP / MAC</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Tempo Conectado</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-400 dark:text-gray-500">
                  Nenhum acesso registrado.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2">{item.nome}</td>
                  <td className="px-4 py-2">{item.ip}</td>
                  <td className="px-4 py-2">{item.plano}</td>
                  <td className="px-4 py-2">{item.tempo}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-white text-xs ${
                      item.status === "Ativo" ? "bg-green-500" :
                      item.status === "Expirado" ? "bg-gray-500" : "bg-red-500"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => encerrar(item.id)}
                      className="text-red-600 dark:text-red-400 hover:underline text-sm"
                    >
                      Encerrar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}