"use client";

import { useEffect, useMemo, useState } from "react";

// ---------- utils ----------
const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDateBR = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Cuiaba",
    dateStyle: "short",
    timeStyle: "short",
  });
};

const toYMDLocal = (d) => {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
};
const startOfMonthLocal = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const todayLocal = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const ranges = (key) => {
  const today = todayLocal();
  if (key === "today") return { from: toYMDLocal(today), to: toYMDLocal(today) };
  if (key === "7d")   { const s = new Date(today); s.setDate(s.getDate() - 6);  return { from: toYMDLocal(s), to: toYMDLocal(today) }; }
  if (key === "30d")  { const s = new Date(today); s.setDate(s.getDate() - 29); return { from: toYMDLocal(s), to: toYMDLocal(today) }; }
  if (key === "month"){ const s = startOfMonthLocal(today); return { from: toYMDLocal(s), to: toYMDLocal(today) }; }
  return null;
};

const PERIODOS = [
  { key: "today", label: "Hoje" },
  { key: "7d",    label: "Últimos 7 dias" },
  { key: "30d",   label: "Últimos 30 dias" },
  { key: "month", label: "Este mês" },
  { key: "custom",label: "Personalizado" },
];

const STATUS_OPTS = [
  { key: "all", label: "Todos" },
  { key: "pago", label: "Pago" },
  { key: "pendente", label: "Pendente" },
  { key: "expirado", label: "Expirado" },
];

// ---------- page ----------
export default function PagamentosPage() {
  // período default: 30d
  const def = ranges("30d");
  const [periodo, setPeriodo] = useState("30d");
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);

  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState(""); // debounce simples

  const [data, setData] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aplicando, setAplicando] = useState(false);

  // debounce do q (300ms)
  useEffect(() => {
    const t = setTimeout(() => setQDeb(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (qDeb) params.set("q", qDeb);
    if (status !== "all") params.set("status", status);
    return `/api/pagamentos?${params.toString()}`;
  }, [from, to, qDeb, status]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setCarregando(true);
      setErro("");
      try {
        const res = await fetch(apiUrl, { cache: "no-store" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || "Falha ao carregar pagamentos");
        }
        const j = await res.json();
        if (!cancel) setData(j);
      } catch (e) {
        if (!cancel) setErro(e.message || "Erro ao carregar pagamentos");
      } finally {
        if (!cancel) setCarregando(false);
      }
    })();
    return () => { cancel = true; };
  }, [apiUrl]);

  function onChangePeriodo(v) {
    setPeriodo(v);
    if (v !== "custom") {
      const r = ranges(v);
      if (r) { setFrom(r.from); setTo(r.to); }
    }
  }

  function aplicarCustom() {
    if (!from || !to) return alert("Selecione as duas datas.");
    if (from > to)   return alert("A data inicial não pode ser maior que a final.");
    setAplicando(true);
    setTimeout(() => setAplicando(false), 150);
  }

  function exportCSV() {
    const rows = data?.itens || [];
    if (!rows.length) return alert("Nada para exportar.");
    const header = ["ID","Descrição","Plano","Valor","Status","Data","Forma","MAC","IP","Roteador"];
    const lines = rows.map(r => [
      r.id,
      (r.descricao ?? "").replaceAll('"','""'),
      (r.plano ?? "").replaceAll('"','""'),
      (Number(r.valor)||0).toFixed(2).replace('.',','),
      r.status,
      fmtDateBR(r.data),
      r.forma,
      r.mac ?? "",
      r.ip ?? "",
      r.roteador ?? "",
    ]);
    const csv = [header, ...lines]
      .map(cols => cols.map(c => `"${String(c)}"`).join(";"))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pagamentos_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="p-6 md:p-8 bg-[#F0F6FA] dark:bg-[#1a2233] min-h-screen transition-colors">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-6">
        Histórico de Pagamentos
      </h1>

      {/* filtros */}
      <div className="mb-6 flex flex-col gap-3 md:gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Período</label>
            <select
              value={periodo}
              onChange={(e) => onChangePeriodo(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#232e47] text-gray-800 dark:text-gray-100"
            >
              {PERIODOS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>

          {periodo === "custom" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">De</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e)=>setFrom(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#232e47] text-gray-800 dark:text-gray-100"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">Até</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e)=>setTo(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#232e47] text-gray-800 dark:text-gray-100"
                />
              </div>
              <button
                onClick={aplicarCustom}
                disabled={aplicando}
                className="h-[40px] self-end px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-60"
              >
                {aplicando ? "Aplicando..." : "Aplicar"}
              </button>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Status</label>
            <select
              value={status}
              onChange={(e)=>setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#232e47] text-gray-800 dark:text-gray-100"
            >
              {STATUS_OPTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Buscar</label>
            <input
              type="text"
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="Descrição, plano, MAC, IP, roteador..."
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#232e47] text-gray-800 dark:text-gray-100 min-w-[260px]"
            />
          </div>

          <button
            onClick={exportCSV}
            className="h-[40px] self-end bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* resumo do período */}
      {data?.periodo && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          Período: <b>{data.periodo.from}</b> → <b>{data.periodo.to}</b> • {data.periodo.days} dia(s)
          {data?.resumo && (
            <> • {data.resumo.qtdPagos} pagos ({brl(data.resumo.totalPagos)}), {data.resumo.qtdPendentes} pendentes, {data.resumo.qtdExpirados} expirados</>
          )}
        </p>
      )}

      {/* tabela */}
      <div className="overflow-x-auto rounded-xl shadow bg-white dark:bg-[#232e47] transition-colors">
        <table className="min-w-full text-sm text-left text-gray-700 dark:text-gray-200">
          <thead className="bg-gray-100 dark:bg-[#1a2233] text-gray-700 dark:text-gray-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Forma</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">MAC</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-500">Carregando...</td></tr>
            ) : (data?.itens?.length ? (
              data.itens.map((r) => (
                <tr key={r.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2">{r.descricao || "-"}</td>
                  <td className="px-4 py-2">{r.plano || "-"}</td>
                  <td className="px-4 py-2">{brl(r.valor)}</td>
                  <td className="px-4 py-2">{r.forma}</td>
                  <td className="px-4 py-2">{fmtDateBR(r.data)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded-full text-white text-xs
                      ${r.status === "pago" ? "bg-green-600"
                        : r.status === "pendente" ? "bg-yellow-500"
                        : r.status === "expirado" ? "bg-red-600"
                        : "bg-gray-500"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{r.mac || "-"}</td>
                  <td className="px-4 py-2">{r.ip || "-"}</td>
                  <td className="px-4 py-2 text-center">
                    <button
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                      onClick={() => alert(JSON.stringify(r, null, 2))}
                    >
                      Ver Detalhes
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400 dark:text-gray-500">
                Nenhum pagamento encontrado.
              </td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
