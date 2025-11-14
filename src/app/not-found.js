// src/app/not-found.js

export default function NotFound() {
  return (
    <html lang="pt-br">
      <body className="min-h-screen flex items-center justify-center bg-[#0f172a] text-slate-100">
        <div className="text-center px-4">
          <h1 className="text-4xl font-bold mb-4">Página não encontrada</h1>
          <p className="mb-6 text-slate-300">
            A página que você tentou acessar não existe ou foi movida.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg px-5 py-3 font-semibold
                       bg-blue-600 text-white hover:bg-blue-700
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400"
          >
            Voltar ao dashboard
          </a>
        </div>
      </body>
    </html>
  );
}
