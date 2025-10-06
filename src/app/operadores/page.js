"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UserCog } from "lucide-react";

const API = "/api/operadores";

export default function OperadoresPage() {
  const [operadores, setOperadores] = useState([]);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingLista, setLoadingLista] = useState(false);

  const formRef = useRef(null);
  const nomeRef = useRef(null);
  const senhaRef = useRef(null);

  const safeNome = (nome ?? "").toString();
  const safeSenha = (senha ?? "").toString();

  const podeSalvar = useMemo(() => {
    if (loading) return false;
    if (modoEdicao) return safeNome.trim().length > 0;
    return safeNome.trim().length > 0 && safeSenha.trim().length > 0;
  }, [loading, modoEdicao, safeNome, safeSenha]);

  async function fetchOperadores() {
    try {
      setLoadingLista(true);
      const res = await fetch(API, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao listar operadores");
      const data = await res.json();
      setOperadores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar operadores.");
    } finally {
      setLoadingLista(false);
    }
  }

  useEffect(() => {
    fetchOperadores();
  }, []);

  async function handleCriar() {
    const usuario = safeNome.trim();
    const s = safeSenha.trim();
    if (!usuario || !s) return;

    setLoading(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha: s, ativo }),
      });
      if (!res.ok) throw new Error("Erro ao cadastrar operador");
      limparFormulario();
      fetchOperadores();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEditar() {
    const usuario = safeNome.trim();
    if (!usuario || !editandoId) return;

    setLoading(true);
    try {
      const payload = { usuario };
      if (safeSenha.trim()) payload.senha = safeSenha.trim();
      payload.ativo = ativo;

      const res = await fetch(`${API}/${editandoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erro ao salvar alterações");
      cancelarEdicao();
      fetchOperadores();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletar(id) {
    if (!confirm("Deseja excluir este operador?")) return;
    try {
      const res = await fetch(`${API}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir operador");
      fetchOperadores();
    } catch (e) {
      alert(e.message);
    }
  }

  function iniciarEdicao(op) {
    setNome(op.usuario ?? op.nome ?? "");
    setSenha("");
    setAtivo(op.ativo ?? true);
    setEditandoId(op.id);
    setModoEdicao(true);
    setTimeout(() => nomeRef.current?.focus(), 0);
  }

  function cancelarEdicao() {
    setModoEdicao(false);
    setEditandoId(null);
    limparFormulario();
  }

  function limparFormulario() {
    setNome("");
    setSenha("");
    setAtivo(true);
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!podeSalvar) return;
    modoEdicao ? handleEditar() : handleCriar();
  }

  return (
    <div
      className="
        min-h-screen rounded-xl shadow-sm p-6 md:p-8
        bg-[#F8FAFC] dark:bg-[#1a2233]
        transition-colors duration-300
      "
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40">
          <UserCog className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Operadores
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gerencie os operadores com acesso ao sistema Lopesul Wi-Fi.
          </p>
        </div>
      </div>

      {/* Formulário */}
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="
          flex flex-col md:flex-row md:items-end gap-4 mb-8
          bg-[#F8FAFC] dark:bg-[#273449]
          border border-slate-700
          rounded-2xl shadow-md p-5
        "
      >
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-gray-600 dark:text-gray-400">Nome</label>
          <input
            ref={nomeRef}
            type="text"
            placeholder="Nome do operador"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="
              px-4 py-2 rounded-lg border
              border-slate-300 dark:border-slate-700
              bg-white dark:bg-[#1e293b]
              text-gray-900 dark:text-gray-100
              focus:ring-2 focus:ring-blue-600 outline-none transition-all
            "
          />
        </div>

        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-gray-600 dark:text-gray-400">
            {modoEdicao ? "Nova senha (opcional)" : "Senha"}
          </label>
          <input
            ref={senhaRef}
            type="password"
            placeholder={modoEdicao ? "Nova senha (opcional)" : "Senha"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="
              px-4 py-2 rounded-lg border
              border-slate-300 dark:border-slate-700
              bg-white dark:bg-[#1e293b]
              text-gray-900 dark:text-gray-100
              focus:ring-2 focus:ring-blue-600 outline-none transition-all
            "
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 select-none">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="accent-blue-600 w-4 h-4"
          />
          Ativo
        </label>

        <div className="flex gap-2">
        <button
          type="submit"
          disabled={!podeSalvar || loading}
          className="
             px-6 py-2.5 rounded-md font-semibold text-white
             bg-blue-600 hover:bg-blue-700 active:bg-blue-700
             shadow-md hover:shadow-lg active:shadow-inner
             transition-all duration-200 ease-in-out
             focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-blue-700
           "
       >

            {loading ? "Aguarde..." : modoEdicao ? "Salvar" : "Cadastrar"}
          </button>

          {modoEdicao && (
            <button
              type="button"
              onClick={cancelarEdicao}
              disabled={loading}
              className="
                px-5 py-2.5 rounded-lg font-medium text-white
                bg-gray-600 hover:bg-gray-700 transition-all shadow-sm
              "
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Tabela */}
      <div
       className="
          overflow-x-auto
          bg-[#F8FAFC] dark:bg-[#1E293B]
          border border-slate-700
          rounded-2xl shadow-md
        "
  >
        <table className="w-full text-sm text-left text-gray-800 dark:text-gray-200">
          <thead className="bg-[#273449] text-gray-200">
            <tr>
              <th className="p-3 font-semibold">Nome</th>
              <th className="p-3 font-semibold text-center">Status</th>
              <th className="p-3 font-semibold text-center w-56">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loadingLista ? (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : operadores.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500">
                  Nenhum operador cadastrado.
                </td>
              </tr>
            ) : (
              operadores.map((op) => (
                <tr
                  key={op.id}
                  className="
                    border-t border-slate-300 dark:border-slate-700
                    hover:bg-slate-50 dark:hover:bg-[#141c2e]
                    transition-colors
                  "
                >
                  <td className="p-3">{op.usuario ?? op.nome}</td>
                  <td className="p-3 text-center">
                    {op.ativo ? (
                      <span className="inline-flex items-center gap-2 px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-full text-xs font-semibold">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-semibold">
                        <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => iniciarEdicao(op)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white
                                   px-3 py-1 rounded-md text-xs font-semibold transition-all"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeletar(op.id)}
                        className="bg-red-600 hover:bg-red-700 text-white
                                   px-3 py-1 rounded-md text-xs font-semibold transition-all"
                      >
                        Excluir
                      </button>
                    </div>
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
