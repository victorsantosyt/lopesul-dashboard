// src/app/dashboard/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ProtectedRoute from "../../components/ProtectedRoute";

const fmtBRL = (v) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

// ===== Configs =====
const TTL_MS = 30_000;
const DASH_TIMEOUT = 4500;
const PAYS_TIMEOUT = 4500;
const SESS_TIMEOUT = 4500;
const MTK_TIMEOUT = 3000;
const MTK_POLL_MS = 15_000;

// ===== Helpers =====
async function fetchJSON(url, { timeoutMs = 4000, signal, cache = "no-store" } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: signal || ctl.signal, cache });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data };
  } finally {
    clearTimeout(timer);
  }
}

function getCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (!t) return null;
    if (Date.now() - t > TTL_MS) return { stale: true, v };
    return { stale: false, v };
  } catch {
    return null;
  }
}

function setCache(key, v) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v }));
  } catch {}
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  const [dash, setDash] = useState(null);
  const [ultimos, setUltimos] = useState([]);
  const [acessos, setAcessos] = useState([]);

  const [status, setStatus] = useState({
    starlink: null,
    mikrotik: null,
    rttMs: null,
    identity: null,
  });

  const mountedRef = useRef(false);

  // ====== STATUS (Mikrotik/Starlink) ======
  async function carregarStatus(abortSignal) {
    try {
      const r = await fetchJSON("/api/mikrotik/status", {
        timeoutMs: MTK_TIMEOUT,
        signal: abortSignal,
        cache: "no-store",
      });

      if (r?.ok && r?.data) {
        const j = r.data;
        const mik = j.ok ? "online" : "offline";
        const star = j.flags?.hasLink && j.flags?.pingSuccess ? "online" : "offline";
        const rtt = j.flags?.rttMs ?? j.rttMs ?? null;
        const ident = j.identity ?? j.routerId ?? null;

        setStatus({ mikrotik: mik, starlink: star, rttMs: rtt, identity: ident });
        setCache("dash:status:v1", { mikrotik: mik, starlink: star, rttMs: rtt, identity: ident });
        return;
      }
    } catch {
      console.warn("Falha no /api/mikrotik/status, tentando fallback…");
    }

    // fallback
    try {
      const rDisp = await fetchJSON("/api/dispositivos/status", {
        timeoutMs: MTK_TIMEOUT,
        signal: abortSignal,
        cache: "no-store",
      });
      if (rDisp?.ok && Array.isArray(rDisp.data)) {
        const anyMikro = rDisp.data.some((d) => d?.tipo === "mikrotik" && d.status === "online");
        const anyStar = rDisp.data.some((d) => d?.tipo === "starlink" && d.status === "online");
        setStatus({
          mikrotik: anyMikro ? "online" : "offline",
          starlink: anyStar ? "online" : "offline",
          rttMs: null,
        });
      }
    } catch {}
  }

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const ac = new AbortController();
    setErro(null);

    const cDash = getCache("dash:dashboard:v1");
    const cPays = getCache("dash:ultimos:v1");
    const cSess = getCache("dash:sessoes:v1");
    const cSta = getCache("dash:status:v1");

    if (cDash?.v) setDash(cDash.v);
    if (cPays?.v) setUltimos(cPays.v);
    if (cSess?.v) setAcessos(cSess.v);
    if (cSta?.v) setStatus((s) => ({ ...s, ...cSta.v }));

    if (cDash?.v || cPays?.v || cSess?.v) setLoading(false);

    (async () => {
      try {
        const [rDash, rPays, rSess] = await Promise.allSettled([
          fetchJSON(`/api/dashboard?days=30`, { timeoutMs: DASH_TIMEOUT, signal: ac.signal }),
          fetchJSON(`/api/pagamentos?limit=5&status=pago`, { timeoutMs: PAYS_TIMEOUT, signal: ac.signal }),
          fetchJSON(`/api/sessoes?ativas=true&limit=10`, { timeoutMs: SESS_TIMEOUT, signal: ac.signal }),
        ]);

        if (rDash.status === "fulfilled" && rDash.value?.ok && rDash.value.data) {
          setDash(rDash.value.data);
          setCache("dash:dashboard:v1", rDash.value.data);
        }
        if (rPays.status === "fulfilled" && rPays.value?.ok) {
          const lista = Array.isArray(rPays.value.data)
            ? rPays.value.data
            : rPays.value.data?.items ?? [];
          setUltimos(lista);
          setCache("dash:ultimos:v1", lista);
        }
        if (rSess.status === "fulfilled" && rSess.value?.ok) {
          const lista = Array.isArray(rSess.value.data)
            ? rSess.value.data
            : rSess.value.data?.items ?? [];
          setAcessos(lista);
          setCache("dash:sessoes:v1", lista);
        }
      } catch (e) {
        console.error(e);
        setErro("Falha ao carregar dados do dashboard.");
      } finally {
        setLoading(false);
      }
    })();

    carregarStatus(ac.signal);
    const t = setInterval(() => carregarStatus(ac.signal), MTK_POLL_MS);

    return () => {
      clearInterval(t);
      ac.abort();
    };
  }, []);

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
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={2} className="py-4 text-gray-400 dark:text-gray-500">
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
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="text-center py-4 text-gray-400 dark:text-gray-500">
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
              <h3 className="font-semibold mb-2 text-gray-800 dark:text-white">Starlink</h3>
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
