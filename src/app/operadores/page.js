"use client";
import { useState, useEffect } from "react";

export default function OperadoresPage() {
  const [operadores, setOperadores] = useState([]);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [modoEdicao, setModoEdicao] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  // GET
  const fetchOperadores = async () => {
    const res = await fetch("/api/operador-api");
    const data = await res.json();
    setOperadores(data);
  };

  useEffect(() => {
    fetchOperadores();
  }, []);

  // POST
  const handleCriar = async () => {
    if (!nome || !senha) return alert("Preencha nome e senha");
    const res = await fetch("/api/operador-api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, senha }),
    });
    if (res.ok) {
      setNome("");
      setSenha("");
      fetchOperadores();
    }
  };

  // PUT
  const handleEditar = async () => {
    if (!nome) return alert("Nome obrigatório");
    const res = await fetch(`/api/operador-api/${editandoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, senha }),
    });
    if (res.ok) {
      setModoEdicao(false);
      setEditandoId(null);
      setNome("");
      setSenha("");
      fetchOperadores();
    }
  };

  // DELETE
  const handleDeletar = async (id) => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    await fetch(`/api/operador-api/${id}`, { method: "DELETE" });
    fetchOperadores();
  };

  const iniciarEdicao = (operador) => {
    setNome(operador.nome);
    setSenha("");
    setEditandoId(operador.id);
    setModoEdicao(true);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Operadores</h1>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Nome do operador"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="px-4 py-2 border rounded"
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="px-4 py-2 border rounded"
        />
        <button
          onClick={modoEdicao ? handleEditar : handleCriar}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          {modoEdicao ? "Salvar" : "Cadastrar"}
        </button>
      </div>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200 text-left">
            <th className="p-2">Nome</th>
            <th className="p-2">Ações</th>
          </tr>
        </thead>
        <tbody>
          {operadores.map((op) => (
            <tr key={op.id} className="border-t">
              <td className="p-2">{op.nome}</td>
              <td className="p-2 flex gap-2">
                <button
                  onClick={() => iniciarEdicao(op)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDeletar(op.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
          {operadores.length === 0 && (
            <tr>
              <td className="p-2 text-gray-500">Nenhum operador ainda.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
