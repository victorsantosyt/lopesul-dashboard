"use client";

import React, { useEffect, useState } from "react";

export default function OperadoresPage() {
  const [operadores, setOperadores] = useState([]);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(false);

  const API = "/api/operadores";

  async function fetchOperadores() {
    try {
      const res = await fetch(API);
      const data = await res.json();
      setOperadores(data);
    } catch (e) {
      console.error("Erro ao carregar operadores:", e);
    }
  }

  useEffect(() => {
    fetchOperadores();
  }, []);

  async function handleCriar() {
    const nomeVal = nome.trim();
    const senhaVal = senha.trim();
    if (!nomeVal || !senhaVal) return;

    setLoading(true);
    try {
      const payload = { nome: nomeVal, senha: senhaVal, ativo };
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Erro ao cadastrar operador");

      setNome("");
      setSenha("");
      setAtivo(true);
      fetchOperadores();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEditar() {
    const nomeVal = nome.trim();
    if (!nomeVal || !editandoId) return;

    setLoading(true);
    try {
      const payload = { nome: nomeVal, ativo };
      if (senha.trim()) payload.senha = senha.trim();

      const res = await fetch(`${API}/${editandoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Erro ao salvar alterações");

      setEditandoId(null);
      setNome("");
      setSenha("");
      fetchOperadores();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExcluir(id) {
    if (!confirm("Excluir operador?")) return;

    try {
      await fetch(`${API}/${id}`, { method: "DELETE" });
      fetchOperadores();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Gerenciamento de Operadores</h1>

      <div className="flex gap-2">
        <input
          className="border p-2 rounded w-1/4"
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <input
          className="border p-2 rounded w-1/4"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={editandoId ? handleEditar : handleCriar}
          disabled={loading}
        >
          {loading
            ? "Salvando..."
            : editandoId
            ? "Salvar Alterações"
            : "Criar Operador"}
        </button>
      </div>

      <div>
        <h2 className="text-xl font-semibold mt-4 mb-2">Operadores Cadastrados</h2>
        <ul className="divide-y border rounded">
          {operadores.map((op) => (
            <li
              key={op.id}
              className="flex justify-between items-center p-2 hover:bg-gray-50"
            >
              <div>
                <span className="font-medium">{op.nome}</span>{" "}
                <span className="text-sm text-gray-500">
                  ({op.ativo ? "Ativo" : "Inativo"})
                </span>
              </div>
              <div className="space-x-2">
                <button
                  className="text-blue-600"
                  onClick={() => {
                    setEditandoId(op.id);
                    setNome(op.nome);
                    setAtivo(op.ativo);
                  }}
                >
                  Editar
                </button>
                <button
                  className="text-red-600"
                  onClick={() => handleExcluir(op.id)}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
