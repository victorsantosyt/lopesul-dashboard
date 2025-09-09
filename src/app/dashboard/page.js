"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "../../components/ProtectedRoute";

const fmtBRL = (v) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [dash, setDash] = useState(null);     // /api/dashboard
  const [ultimos, setUltimos] = useState([]); // /api/pagamentos
  const [acessos, setAcessos] = useState([]); // /api/sessoes

  // ===== NOVO: status e RTT vindos do /api/mikrotik/ping =====
  const [status, setStatus] = useState({
    starlink: null,
    mikrotik: null,
    rttMs: null,
    identity: null,
  });

  // ===== NOVO: função que tenta o ping e cai para o antigo comportamento =====
  async function carregarStatus(ac) {
    try {
      // 1) tenta a rota de ping consolidada
      const rPing = await fetch("/api/mikrotik/ping", { cache: "no-store", signal: ac.signal });
      if (rPing.ok) {
        const j = await rPing.json().catch(() => null);
        if (j) {
          const mik = j?.ok && j?.connected ? "online" : "offline";
          const star = j?.internet?.ok ? "online" : "offline";
          const rtt = j?.internet?.rtt_ms ?? null;
          const ident = j?.identity ?? null;
          setStatus({ mikrotik: mik, starlink: star, rttMs: rtt, identity: ident });
          return; // sucesso → não precisa fallback
        }
      }
    } catch { /* continua no fallback */ }

    // 2) Fallback: usa /api/dispositivos/status → /api/dispositivos
    try {
      const rDisp =
        (await fetch(`/api/dispositivos/status`, { cache: "no-store", signal: ac.signal }))
          .ok
          ? await fetch(`/api/dispositivos/status`, { cache: "no-store", signal: ac.signal })
          : await fetch(`/api/dispositivos`, { cache: "no-store", signal: ac.signal });

      if (rDisp.ok) {
        const j = await rDisp.json();
        const lista = Array.isArray(j) ? j : j.items ?? [];
        const anyMikroOnline = lista.some((d) => d?.status === "online" || d?.online === true);
        const anyStarOnline = lista.some(
          (d) =>
            (d?.tipo?.toLowerCase?.() === "starlink" ||
              d?.nome?.toLowerCase?.().includes("starlink")) &&
            (d?.status === "online" || d?.online === true)
        );
        setStatus((old) => ({
          ...old,
          mikrotik: anyMikroOnline ? "online" : "offline",
          starlink: anyStarOnline ? "online" : "offline",
        }));
      }
    } catch { /* silencia */ }
  }

  useEffect(() => {
    const ac = new AbortController();

    async function carregar() {
      try {
        setErro(null);
        setLoading(true);

        const [rDash, rPays, rSess] = await Promise.allSettled([
          fetch(`/api/dashboard?days=30`, { cache: "no-store", signal: ac.signal }),
          fetch(`/api/pagamentos?limit=5&status=pago`, { cache: "no-store", signal: ac.signal }),
          fetch(`/api/sessoes?ativas=true&limit=10`, { cache: "no-store", signal: ac.signal }),
        ]);

        if (rDash.status === "fulfilled" && rDash.value.ok) {
          setDash(await rDash.value.json());
        }

        if (rPays.status === "fulfilled" && rPays.value.ok) {
          const j = await rPays.value.json();
          setUltimos(Array.isArray(j) ? j : j.items ?? []);
        }

        if (rSess.status === "fulfilled" && rSess.value.ok) {
          const j = await rSess.value.json();
          setAcessos(Array.isArray(j) ? j : j.items ?? []);
        }

        // carrega status uma vez
        await carregarStatus(ac);
      } catch (e) {
        console.error(e);
        setErro("Falha ao carregar dados do dashboard.");
      } finally {
        setLoading(false);
      }
    }

    carregar();

    // ===== NOVO: atualiza status periodicamente (15s) =====
    const t = setInterval(() => carregarStatus(ac), 15000);

    return () => {
      ac.abort();
      clearInterval(t);
    };
  }, []);

  // KPIs derivados da /api/dashboard
  const kpis = useMemo(() => {
    const k = dash?.kpis;
    const inv = dash?.inventario;
    const op = dash?.operacao;
    return {
      receitaPeriodo: k?.receita ?? 0,
      vendasPeriodo: k?.qtdVendas ?? 0,
      acessosAtivos: op?.sessoesAtivas ?? 0,
      operadores: op?.operadores ?? 0,
      frotas: inv?.frotas ?? 0,
      dispositivos: inv?.dispositivos ?? 0,
    };
  }, [dash]);

  return (
    <ProtectedRoute>
      <div className="p-6 md:p-8 bg-[#F0F6FA] dark:bg-[#1a2233] min-h-screen transition-colors">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {dash?.periodo
              ? `Período: ${new Date(dash.periodo.from).toLocaleDateString("pt-BR")} — ${new Date(
                  dash.periodo.to
                ).toLocaleDateString("pt-BR")}`
              : null}
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { title: "Receita (30 dias)", value: fmtBRL(kpis.receitaPeriodo) },
            { title: "Vendas (30 dias)", value: kpis.vendasPeriodo },
            { title: "Acessos Ativos", value: kpis.acessosAtivos },
            { title: "Operadores", value: kpis.operadores },
          ].map(({ title, value }) => (
            <div
              key={title}
              className="bg-blue-600 dark:bg-blue-700 text-white rounded-xl p-4 text-center shadow transition-colors"
            >
              <div className="text-sm opacity-90">{title}</div>
              <div className="text-2xl font-bold">{loading ? "…" : value ?? "--"}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Acessos ativos */}
          <div className="bg-white dark:bg-[#232e47] rounded-xl p-4 shadow col-span-2 transition-colors">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
              Acessos Ativos
            </h2>

            {erro ? (
              <div className="text-sm text-red-500">{erro}</div>
            ) : (
              <table className="w-full text-sm text-gray-700 dark:text-gray-300">
                <thead className="text-left border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="text-gray-800 dark:text-white">Cliente / IP</th>
                    <th className="text-gray-800 dark:text-white">Expira em</th>
                    <th className="text-center text-gray-800 dark:text-white">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-gray-400 dark:text-gray-500">
                        Carregando…
                      </td>
                    </tr>
                  ) : acessos.length > 0 ? (
                    acessos.map((s) => (
                      <tr key={s.id} className="border-b border-gray-200 dark:border-gray-600">
                        <td className="py-2">
                          {s.cliente ?? s.ipCliente ?? s.macCliente ?? "—"}
                        </td>
                        <td>{s.expiraEm ? fmtData(s.expiraEm) : "—"}</td>
                        <td className="text-center">
                          <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md transition">
                            Bloquear
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-center py-4 text-gray-400 dark:text-gray-500">
                        Sem acessos no momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Status + últimos pagamentos */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#232e47] p-4 rounded-xl shadow transition-colors">
              <h3 className="font-semibold mb-2 text-gray-800 dark:text-white">
                Starlink
              </h3>
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    status.starlink === "online" ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                <span className="text-gray-700 dark:text-gray-300">
                  {status.starlink ?? "Aguardando…"}
                  {status.rttMs != null && status.starlink === "online" ? ` • ${status.rttMs} ms` : ""}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#232e47] p-4 rounded-xl shadow transition-colors">
              <h3 className="font-semibold mb-2 text-gray-800 dark:text-white">MikroTik</h3>
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    status.mikrotik === "online" ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                <span className="text-gray-700 dark:text-gray-300">
                  {status.mikrotik ?? "Aguardando…"}
                  {status.identity ? ` • ${status.identity}` : ""}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#232e47] p-4 rounded-xl shadow transition-colors">
              <h3 className="font-semibold mb-3 text-gray-800 dark:text-white">Últimos Pagamentos</h3>
              <ul className="text-sm space-y-2">
                {loading ? (
                  <li className="text-gray-400 dark:text-gray-500">Carregando…</li>
                ) : ultimos.length > 0 ? (
                  ultimos.map((p) => (
                    <li key={p.id} className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{fmtData(p.criadoEm)}</span>
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {p.descricao ?? p.plano ?? "Pagamento"}
                      </span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {fmtBRL(p.valor)}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-400 dark:text-gray-500">Nenhum pagamento ainda.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
