"use client";

import { useEffect, useMemo, useState } from "react";
import EChart from "@/components/EChart";



function fmtBRL(v) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function iso(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export default function RelatoriosPage() {
  const [range, setRange] = useState("30"); // "7", "30", "90"
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const to = useMemo(() => new Date(), []);
  const from = useMemo(() => addDays(to, -Number(range || 30)), [to, range]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const url = `/api/relatorios?from=${iso(from)}&to=${iso(to)}`;
        const res = await fetch(url, { cache: "no-store" });
        const j = await res.json();
        if (!cancel) setData(j);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [from, to]);


  const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark");
  const axisColor = isDark ? "#a3aed0" : "#475569";
  const gridColor = isDark ? "#334155" : "#e5e7eb";
  const titleColor = isDark ? "#e2e8f0" : "#0f172a";


  const vendasPorDia = data?.series?.vendasPorDia ?? [];
  const pagosPorDia = data?.series?.pagosPorDia ?? [];
  const faturamentoPorFrota = data?.faturamentoPorFrota ?? [];

  const vendasLabels = vendasPorDia.map((d) => d.date);
  const vendasVals = vendasPorDia.map((d) => d.total ?? 0);

  const pagosLabels = pagosPorDia.map((d) => d.date);
  const pagosVals = pagosPorDia.map((d) => d.count ?? 0);

  const frotaLabels = faturamentoPorFrota.map((d) => d.nome ?? "Frota");
  const frotaVals = faturamentoPorFrota.map((d) => Math.round(d.total ?? 0));

  
  const lineBase = {
    grid: { left: 40, right: 20, top: 30, bottom: 35 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      boundaryGap: false,
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: gridColor } },
      data: [],
    },
    yAxis: {
      type: "value",
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: gridColor } },
      splitLine: { show: true, lineStyle: { color: gridColor, type: "dashed" } },
    },
    textStyle: { color: axisColor },
  };

  const vendasOption = {
    ...lineBase,
    xAxis: { ...lineBase.xAxis, data: vendasLabels },
    series: [{ name: "Vendas", type: "line", smooth: true, showSymbol: false, areaStyle: { opacity: 0.08 }, lineStyle: { width: 2 }, data: vendasVals }],
  };

  const pagosOption = {
    ...lineBase,
    xAxis: { ...lineBase.xAxis, data: pagosLabels },
    series: [{ name: "Pagos", type: "line", smooth: true, showSymbol: false, areaStyle: { opacity: 0.08 }, lineStyle: { width: 2 }, data: pagosVals }],
  };

  const barrasOption = {
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => fmtBRL(v) },
    xAxis: {
      type: "category",
      axisLabel: { color: axisColor, rotate: frotaLabels.some(n => (n?.length ?? 0) > 12) ? 30 : 0 },
      axisLine: { lineStyle: { color: gridColor } },
      data: frotaLabels,
    },
    yAxis: {
      type: "value",
      axisLabel: { color: axisColor },
      axisLine: { lineStyle: { color: gridColor } },
      splitLine: { show: true, lineStyle: { color: gridColor, type: "dashed" } },
    },
    textStyle: { color: axisColor },
    series: [{ type: "bar", data: frotaVals, barWidth: 28, itemStyle: { borderRadius: [8, 8, 0, 0] } }],
  };

  const resumo = data?.resumo ?? { totalVendas: 0, receita: 0, mediaTempoAcesso: "0 min", pagamentos: { pagos: 0, pendentes: 0, expirados: 0 } };

  return (
    <div className="p-6 md:p-8 bg-transparent min-h-screen transition-colors">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Relatórios e Análises
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Período: {iso(from)} → {iso(to)}
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1e293b] text-gray-800 dark:text-gray-100"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
          <button
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      {/* KPIs com cores suaves */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Vendas (total) — amarelo */}
        <div className="
          rounded-xl p-4 shadow border
          bg-yellow-50 border-yellow-200 text-yellow-900
          dark:bg-yellow-500/10 dark:border-yellow-700 dark:text-yellow-200
        ">
          <div className="text-sm opacity-90">Vendas (total)</div>
          <div className="mt-1 text-2xl font-bold">{fmtBRL(resumo.totalVendas ?? 0)}</div>
          <div className="text-xs opacity-80">{resumo.qtdVendas ?? 0} operações</div>
        </div>

        {/* Pagamentos confirmados — verde */}
        <div className="
          rounded-xl p-4 shadow border
          bg-green-50 border-green-200 text-green-900
          dark:bg-green-500/10 dark:border-green-700 dark:text-green-200
        ">
          <div className="text-sm opacity-90">Pagamentos confirmados</div>
          <div className="mt-1 text-2xl font-bold">{fmtBRL(resumo.receita ?? 0)}</div>
          <div className="text-xs opacity-80">
            {resumo.pagamentos?.pagos ?? 0} pagos • {resumo.pagamentos?.pendentes ?? 0} pend. • {resumo.pagamentos?.expirados ?? 0} exp.
          </div>
        </div>

        {/* Operação — azul */}
        <div className="
          rounded-xl p-4 shadow border
          bg-blue-50 border-blue-200 text-blue-900
          dark:bg-blue-500/10 dark:border-blue-700 dark:text-blue-200
        ">
          <div className="text-sm opacity-90">Operação</div>
          <div className="mt-1 text-2xl font-bold">
            {data?.inventario?.frotas ?? 0} frotas / {data?.inventario?.dispositivos ?? 0} disp.
          </div>
          <div className="text-xs opacity-80">
            {data?.operacao?.operadores ?? 0} oper. • {data?.operacao?.sessoesAtivas ?? 0} sessões ativas
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl p-4 shadow bg-white dark:bg-[#111827]">
          <div className="text-sm font-medium mb-2" style={{ color: titleColor }}>
            Vendas por dia
          </div>
          {loading ? <div className="h-[320px] animate-pulse bg-gray-200/50 dark:bg-white/5 rounded-lg" /> : <EChart option={vendasOption} height={320} />}
        </div>

        <div className="rounded-xl p-4 shadow bg-white dark:bg-[#111827]">
          <div className="text-sm font-medium mb-2" style={{ color: titleColor }}>
            Pagamentos confirmados por dia
          </div>
          {loading ? <div className="h-[320px] animate-pulse bg-gray-200/50 dark:bg-white/5 rounded-lg" /> : <EChart option={pagosOption} height={320} />}
        </div>

        <div className="lg:col-span-2 rounded-xl p-4 shadow bg-white dark:bg-[#111827]">
          <div className="text-sm font-medium mb-2" style={{ color: titleColor }}>
            Faturamento por Frota
          </div>
          {loading ? <div className="h-[380px] animate-pulse bg-gray-200/50 dark:bg-white/5 rounded-lg" /> : <EChart option={barrasOption} height={380} />}
        </div>
      </div>
    </div>
  );
}
