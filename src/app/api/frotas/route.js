import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import MikroNode from "mikronode-ng2";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const host = process.env.MIKROTIK_HOST;
    const user = process.env.MIKROTIK_USER;
    const pass = process.env.MIKROTIK_PASS;

    // 🚧 Validação de ambiente
    if (!host || !user || !pass) {
      console.warn("⚠️ Variáveis do Mikrotik ausentes. Executando em modo offline.");
      return await buildFrotasOffline();
    }

    let pppActives = [];
    try {
      // 🔗 Tenta conectar no Mikrotik real
      const conn = new MikroNode(host);
      const [login] = await conn.connect(user, pass);
      const chan = conn.openChannel();

      chan.write("/ppp/active/print");

      pppActives = await new Promise((resolve) => {
        chan.on("done", (data) => resolve(MikroNode.resultsToObj(data)));
        chan.on("trap", (err) => {
          console.error("⚠️ Erro Mikrotik:", err);
          resolve([]);
        });
      });

      await conn.close();
    } catch (mikroErr) {
      console.warn("⚠️ Mikrotik inacessível, usando modo offline:", mikroErr.message);
      return await buildFrotasOffline();
    }

    // 🔹 Busca as frotas no banco
    const frotas = await prisma.frota.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });

    // 🔹 Monta resposta com status real
    const resposta = frotas.map((f) => {
      const ativo = pppActives.find((s) =>
        s.name?.toLowerCase().includes(f.nome.toLowerCase())
      );
      return {
        ...f,
        vendas: 0,
        acessos: ativo ? 1 : 0,
        status: ativo ? "online" : "offline",
      };
    });

    return NextResponse.json(resposta, { status: 200 });
  } catch (err) {
    console.error("❌ /api/frotas => erro geral:", err);
    return await buildFrotasOffline();
  }
}

// 🔧 Função fallback que garante que o sistema não quebre
async function buildFrotasOffline() {
  try {
    const frotas = await prisma.frota.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });

    const resposta = frotas.map((f) => ({
      ...f,
      vendas: 0,
      acessos: 0,
      status: "offline",
    }));

    return NextResponse.json(resposta, { status: 200 });
  } catch (dbErr) {
    console.error("⚠️ Erro também ao acessar banco:", dbErr);
    return NextResponse.json([], { status: 200 });
  }
}
