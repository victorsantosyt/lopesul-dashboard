// src/app/dispositivos/status/page.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, ShieldCheck, ShieldX, Wifi, Clock, Loader2, Info, CheckCircle2, XCircle
} from 'lucide-react';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// validação simples de IP (v4/v6)
const ipv4 =
  /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
const ipv6 =
  /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(([0-9a-f]{1,4}:){1,7}:)|(([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4})|(([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2})|(([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3})|(([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4})|(([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5})|([0-9a-f]{1,4}:)((:[0-9a-f]{1,4}){1,6})|:((:[0-9a-f]{1,4}){1,7}|:))(%.+)?$/i;
const isValidIp = (s) => ipv4.test(s) || ipv6.test(s);

export default function MikrotikStatusPage() {
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingPPP, setLoadingPPP] = useState(false);
  const [identity, setIdentity] = useState(null);
  const [listName, setListName] = useState('paid_clients');
  const [limit, setLimit] = useState(100);
  const [statusItems, setStatusItems] = useState([]);
  const [pppRows, setPppRows] = useState([]);
  const [msg, setMsg] = useState(null); // {type:'ok'|'err'|'info', text:''}

  // ação por IP (para mostrar spinner só naquele botão)
  const [actingIp, setActingIp] = useState(null);
  const [actingAction, setActingAction] = useState(null); // 'liberar' | 'revogar' | null

  const busy = loadingStatus || loadingPPP;

  async function fetchStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/mikrotik/status?list=${encodeURIComponent(listName)}&limit=${limit}`);
      const j = await res.json();
      if (j?.ok) {
        setIdentity(j.identity || null);
        setStatusItems(Array.isArray(j.items) ? j.items : []);
      } else {
        setStatusItems([]);
        toast('err', j?.error || 'Falha ao carregar status');
      }
    } catch {
      toast('err', 'Erro de rede ao consultar status');
    } finally {
      setLoadingStatus(false);
    }
  }

  async function fetchPPP() {
    setLoadingPPP(true);
    try {
      const res = await fetch(`/api/mikrotik/ppp-active?limit=${limit}`);
      const j = await res.json();
      if (j?.ok) {
        setPppRows(Array.isArray(j.rows) ? j.rows : []);
      } else {
        setPppRows([]);
        toast('err', j?.error || 'Falha ao listar PPP Active');
      }
    } catch {
      toast('err', 'Erro de rede ao consultar PPP Active');
    } finally {
      setLoadingPPP(false);
    }
  }

  async function handleLiberar(ip, busId) {
    if (!isValidIp(ip || '')) {
      toast('err', 'IP inválido');
      return;
    }
    setActingIp(ip); setActingAction('liberar');
    try {
      const res = await fetch('/api/mikrotik/liberar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ip, busId, list: listName }),
      });
      const j = await res.json();
      if (res.ok && j?.ok) {
        toast('ok', `IP ${ip} liberado`);
        await sleep(300);
        fetchStatus();
      } else {
        toast('err', j?.error || `Falha ao liberar ${ip}`);
      }
    } catch {
      toast('err', `Erro de rede ao liberar ${ip}`);
    } finally {
      setActingIp(null); setActingAction(null);
    }
  }

  async function handleRevogar(ip) {
    if (!isValidIp(ip || '')) {
      toast('err', 'IP inválido');
      return;
    }
    setActingIp(ip); setActingAction('revogar');
    try {
      const res = await fetch('/api/mikrotik/revogar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ip, list: listName }),
      });
      const j = await res.json();
      if (res.ok && j?.ok) {
        toast('ok', `IP ${ip} revogado`);
        await sleep(300);
        fetchStatus();
      } else {
        toast('err', j?.error || `Falha ao revogar ${ip}`);
      }
    } catch {
      toast('err', `Erro de rede ao revogar ${ip}`);
    } finally {
      setActingIp(null); setActingAction(null);
    }
  }

  function toast(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  }

  useEffect(() => {
    fetchStatus();
    fetchPPP();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusCount = statusItems.length;
  const pppCount = pppRows.length;

  return (
    <div className="space-y-6">
      {/* Header / Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
        <div className="flex-1">
          <h1 className="text-xl lg:text-2xl font-bold">Status do Mikrotik</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {identity ? <>Roteador: <span className="font-semibold">{identity}</span></> : 'Roteador: —'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            placeholder="address-list (ex.: paid_clients)"
            title="Nome da address-list"
          />
          <input
            type="number"
            min={10}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Math.max(10, Math.min(500, parseInt(e.target.value || '0', 10))))}
            className="w-24 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            placeholder="Limite"
            title="Limite de linhas"
          />
          <button
            onClick={() => { fetchStatus(); fetchPPP(); }}
            disabled={busy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 focus:ring-2 focus:ring-blue-400"
            title="Atualizar"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {/* Alert */}
      {msg && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            msg.type === 'ok'
              ? 'bg-green-600/10 text-green-700 dark:text-green-300 border border-green-600/30'
              : msg.type === 'err'
              ? 'bg-red-600/10 text-red-700 dark:text-red-300 border border-red-600/30'
              : 'bg-sky-600/10 text-sky-700 dark:text-sky-300 border border-sky-600/30'
          }`}
        >
          {msg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> :
           msg.type === 'err' ? <XCircle className="h-4 w-4" /> :
           <Info className="h-4 w-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Address-list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Address-list <span className="font-mono text-slate-500">({listName})</span>
          </h2>
          <span className="text-sm text-slate-600 dark:text-slate-400">Total: {statusCount}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-[640px] w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <tr>
                <th className="text-left px-3 py-2">IP</th>
                <th className="text-left px-3 py-2">Comentário</th>
                <th className="text-left px-3 py-2">Criado</th>
                <th className="text-left px-3 py-2">Ativo</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {statusItems.map((it, idx) => {
                const revoking = actingIp === it.address && actingAction === 'revogar';
                return (
                  <tr key={`${it.id || it.address}-${idx}`} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 font-mono">{it.address || '—'}</td>
                    <td className="px-3 py-2">{it.comment || '—'}</td>
                    <td className="px-3 py-2">{it.creationTime || '—'}</td>
                    <td className="px-3 py-2">{it.disabled ? 'não' : 'sim'}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleRevogar(it.address)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 focus:ring-2 focus:ring-red-400"
                          title="Revogar IP"
                          disabled={!it.address || revoking}
                        >
                          {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />}
                          <span className="hidden md:inline">Revogar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {statusItems.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                    Nenhum item nessa lista.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Liberar manual */}
        <LiberarForm onSubmit={handleLiberar} />
      </section>

      {/* PPP Active */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wifi className="h-5 w-5" /> PPP Active
          </h2>
          <span className="text-sm text-slate-600 dark:text-slate-400">Total: {pppCount}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-[640px] w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <tr>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">IP</th>
                <th className="text-left px-3 py-2">Caller ID</th>
                <th className="text-left px-3 py-2">Serviço</th>
                <th className="text-left px-3 py-2">Uptime</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pppRows.map((r, idx) => {
                const liberating = actingIp === r.address && actingAction === 'liberar';
                return (
                  <tr key={`${r.id || r.name}-${idx}`} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2">{r.name || '—'}</td>
                    <td className="px-3 py-2 font-mono">{r.address || '—'}</td>
                    <td className="px-3 py-2">{r.callerId || '—'}</td>
                    <td className="px-3 py-2">{r.service || '—'}</td>
                    <td className="px-3 py-2 flex items-center gap-1">
                      <Clock className="h-4 w-4" /> {r.uptime || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => r.address && handleLiberar(r.address)}
                          disabled={!r.address || liberating}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 focus:ring-2 focus:ring-emerald-400"
                          title="Liberar este IP"
                        >
                          {liberating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          <span className="hidden md:inline">Liberar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pppRows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                    Nenhuma sessão ativa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function LiberarForm({ onSubmit }) {
  const [ip, setIp] = useState('');
  const [busId, setBusId] = useState('');
  const can = useMemo(() => ip.trim().length > 3, [ip]);

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-end gap-2 md:gap-3">
      <div className="flex-1">
        <label className="block text-sm mb-1">IP</label>
        <input
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          placeholder="Ex.: 10.0.0.55"
          inputMode="decimal"
        />
      </div>
      <div className="md:w-64">
        <label className="block text-sm mb-1">Ônibus / Bus ID (opcional)</label>
        <input
          value={busId}
          onChange={(e) => setBusId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          placeholder="Ex.: BUS-001"
        />
      </div>
      <div className="md:w-auto">
        <label className="block text-sm mb-1 invisible md:visible"> </label>
        <button
          disabled={!can}
          onClick={() => can && onSubmit(ip.trim(), busId.trim() || undefined)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 focus:ring-2 focus:ring-emerald-400"
          title="Liberar IP manualmente"
        >
          <ShieldCheck className="h-5 w-5" />
          <span className="hidden sm:inline">Liberar IP</span>
        </button>
      </div>
    </div>
  );
}
