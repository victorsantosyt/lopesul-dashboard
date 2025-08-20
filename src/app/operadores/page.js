"use client";

import { useEffect, useMemo, useState } from "react";

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

  // bloqueia submit se campos inválidos
  const podeSalvar = useMemo(() => {
    if (loading) return false;
    if (modoEdicao) return nome.trim().length > 0;           // senha é opcional no edit
    return nome.trim().length > 0 && senha.trim().length > 0; // no create, ambos
  }, [loading, modoEdicao, nome, senha]);

  async function fetchOperadores() {
    try {
      setLoadingLista(true);
      const res = await fetch(API, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao listar operadores");
      const data = await res.json();
      setOperadores(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      alert("Não foi possível carregar os operadores.");
    } finally {
      setLoadingLista(false);
    }
  }

  useEffect(() => {
    fetchOperadores();
  }, []);

  async function handleCriar() {
    const n = nome.trim();
    const s = senha.trim();
    if (!n || !s) return;

    setLoading(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: n, senha: s, ativo }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Erro ao cadastrar operador");
      }
      limparFormulario();
      fetchOperadores();
    } catch (e) {
      console.error(e);
      alert(e.message || "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEditar() {
    const n = nome.trim();
    if (!n || !editandoId) return;

    setLoading(true);
    try {
      const payload = { nome: n, ativo };
      if (senha.trim()) payload.senha = senha.trim(); // só envia se alterar

      const res = await fetch(`${API}/${editandoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Erro ao salvar alterações");
      }
      cancelarEdicao();
      fetchOperadores();
    } catch (e) {
      console.error(e);
      alert(e.message || "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletar(id) {
    if (!confirm("Tem certeza que deseja excluir este operador?")) return;
    try {
      const res = await fetch(`${API}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Erro ao excluir");
      }
      fetchOperadores();
    } catch (e) {
      console.error(e);
      alert(e.message || "Erro ao excluir.");
    }
  }

  function iniciarEdicao(op) {
    setNome(op.nome);
    setSenha("");
    setAtivo(op.ativo ?? true);
    setEditandoId(op.id);
    setModoEdicao(true);
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
    <div className="p-6 md:p-8 bg-[#F0F6FA] dark:bg-[#1a2233] min-h-screen transition-colors">
      <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Operadores</h1>

      <form onSubmit={onSubmit} className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">Nome</label>
          <input
            type="text"
            placeholder="Nome do operador"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#232e47] text-gray-800 dark:text-gray-100"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            {modoEdicao ? "Nova senha (opcional)" : "Senha"}
          </label>
          <input
            type="password"
            placeholder={modoEdicao ? "Nova senha (opcional)" : "Senha"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#232e47] text-gray-800 dark:text-gray-100"
          />
        </div>

        <label className="flex items-center gap-2 select-none text-sm text-gray-700 dark:text-gray-200">
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
            disabled={!podeSalvar}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded"
          >
            {loading ? "Aguarde..." : modoEdicao ? "Salvar" : "Cadastrar"}
          </button>

          {modoEdicao && (
            <button
              type="button"
              onClick={cancelarEdicao}
              disabled={loading}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl shadow bg-white dark:bg-[#232e47] transition-colors">
        <table className="w-full text-sm text-left text-gray-700 dark:text-gray-200">
          <thead>
            <tr className="bg-gray-200 dark:bg-[#1a2233] text-left text-gray-700 dark:text-gray-300">
              <th className="p-3">Nome</th>
              <th className="p-3">Status</th>
              <th className="p-3 w-56">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loadingLista ? (
              <tr>
                <td colSpan={3} className="p-3 text-gray-500 dark:text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : operadores.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-3 text-gray-500 dark:text-gray-400">
                  Nenhum operador ainda.
                </td>
              </tr>
            ) : (
              operadores.map((op) => (
                <tr key={op.id} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="p-3">{op.nome}</td>
                  <td className="p-3">
                    {op.ativo ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        ● <span className="text-xs">Ativo</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        ● <span className="text-xs">Inativo</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => iniciarEdicao(op)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeletar(op.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
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
