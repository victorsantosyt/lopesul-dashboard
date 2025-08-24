import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/* -------------------------- helpers de data -------------------------- */
const isYMD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const atStart = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const atEnd   = (d) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const ymd     = (d) => d.toISOString().slice(0,10);

/* ---------------------- util: plano a partir da descrição ------------ */
function extrairPlano(descricao = "") {
  const d = (descricao || "").toLowerCase();
  if (d.includes("48h")) return "48h";
  if (d.includes("24h")) return "24h";
  if (d.includes("12h")) return "12h";
  return null;
}

/* ----------------------- EMV/BR Code helpers (server) ---------------- */
function emv(id, value){ const v = String(value); return id + String(v.length).padStart(2,"0") + v; }
function crc16(payload){
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function gerarPixPayload({ chave, valor, nome, cidade, txid, descricao }) {
  const nomeLim = (nome || "LOPESUL WIFI").toUpperCase().slice(0, 25);
  const cidLim  = (cidade || "SAO PAULO").toUpperCase().slice(0, 15);
  const txidLim = (txid || `LP${Date.now()}`).slice(0, 25);
  const valorFmt = Number(valor).toFixed(2);

  const id00 = emv("00","01");
  const id01 = emv("01","11"); // estático
  const id26 = emv("26",
    emv("00","BR.GOV.BCB.PIX") +
    emv("01", String(chave)) +
    (descricao ? emv("02", String(descricao).slice(0,60)) : "")
  );
  const id52 = emv("52","0000");
  const id53 = emv("53","986");
  const id54 = emv("54", valorFmt);
  const id58 = emv("58","BR");
  const id59 = emv("59", nomeLim);
  const id60 = emv("60", cidLim);
  const id62 = emv("62", emv("05", txidLim));

  const semCRC = `${id00}${id01}${id26}${id52}${id53}${id54}${id58}${id59}${id60}${id62}63${"04"}`;
  const crc = crc16(semCRC);
  return `${semCRC}${crc}`;
}

/* =============================== GET =================================
   Lista pagamentos com filtros de período/status/busca
====================================================================== */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const fromQ   = url.searchParams.get("from");
    const toQ     = url.searchParams.get("to");
    const q       = url.searchParams.get("q")?.trim();
    const statusQ = url.searchParams.get("status")?.toLowerCase(); // 'pago' | 'pendente' | 'expirado'

    // período padrão: últimos 30 dias
    const today = new Date();
    let start = new Date(today); start.setDate(start.getDate() - 29); start = atStart(start);
    let end   = atEnd(today);

    if (fromQ) {
      if (!isYMD(fromQ)) return NextResponse.json({ error: "from inválido (YYYY-MM-DD)" }, { status: 400 });
      start = atStart(new Date(fromQ));
    }
    if (toQ) {
      if (!isYMD(toQ)) return NextResponse.json({ error: "to inválido (YYYY-MM-DD)" }, { status: 400 });
      end = atEnd(new Date(toQ));
    }
    if (start > end) return NextResponse.json({ error: '"from" > "to"' }, { status: 400 });

    // proteção de janela
    const MAX_DAYS = 185;
    const days = Math.ceil((atStart(end) - atStart(start)) / (1000*60*60*24)) + 1;
    if (days > MAX_DAYS) {
      return NextResponse.json({ error: `Intervalo muito grande. Máx: ${MAX_DAYS} dias.` }, { status: 400 });
    }

    const whereAND = [
      { criadoEm: { gte: start, lte: end } },
    ];

    if (statusQ && ["pago", "pendente", "expirado"].includes(statusQ)) {
      whereAND.push({ status: statusQ });
    }

    if (q) {
      whereAND.push({
        OR: [
          { descricao: { contains: q, mode: "insensitive" } },
          { clienteMac: { contains: q, mode: "insensitive" } },
          { clienteIp:  { contains: q, mode: "insensitive" } },
        ],
      });
    }

    const pagamentos = await prisma.pagamento.findMany({
      where: { AND: whereAND },
      orderBy: [{ criadoEm: "desc" }],
    });

    const rows = pagamentos.map((p) => ({
      id: p.id,
      descricao: p.descricao || "",
      plano: extrairPlano(p.descricao || ""),
      valor: (Number(p.valorCent || 0) / 100),
      forma: "PIX",
      status: (p.status || "pendente").toLowerCase(),
      data: p.criadoEm,
      mac: p.clienteMac || null,
      ip: p.clienteIp || null,
      roteador: null, // não há esse campo no schema atual
    }));

    const tot = rows.reduce(
      (acc, r) => {
        acc.totalReg += 1;
        if (r.status === "pago") { acc.qtdPagos += 1; acc.totalPagos += r.valor; }
        else if (r.status === "pendente") acc.qtdPend += 1;
        else if (r.status === "expirado") acc.qtdExp += 1;
        return acc;
      },
      { totalReg: 0, qtdPagos: 0, totalPagos: 0, qtdPend: 0, qtdExp: 0 }
    );

    return NextResponse.json({
      periodo: { from: ymd(start), to: ymd(end), days },
      resumo: {
        totalReg: tot.totalReg,
        qtdPagos: tot.qtdPagos,
        qtdPendentes: tot.qtdPend,
        qtdExpirados: tot.qtdExp,
        totalPagos: tot.totalPagos,
      },
      itens: rows,
    });
  } catch (e) {
    console.error("GET /api/pagamentos", e);
    return NextResponse.json({ error: "Erro ao listar pagamentos" }, { status: 500 });
  }
}

/* =============================== POST ================================
   (LEGADO/OPCIONAL) Gera cobrança local usando PIX_KEY e salva
   nos campos do schema atual. O cativo novo usa /api/pagamentos/checkout.
====================================================================== */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      valor,                        // em reais (ex.: 9.90)
      descricao = "Acesso Wi-Fi Lopesul",
      mac: clienteMac,
      ip: clienteIp,
      // chavePix opcional no body, mas priorizamos a do servidor
      chavePix: chavePixBody,
      minAcesso = 120,              // ignorado aqui; usado no Mikrotik mais tarde
    } = body || {};

    const vNum = Number(valor);
    if (!Number.isFinite(vNum) || vNum <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    const valorCent = Math.round(vNum * 100);

    const chavePix = (process.env.PIX_KEY || chavePixBody || "").trim();
    if (!chavePix) {
      return NextResponse.json({ error: "Chave Pix ausente (configure PIX_KEY no .env ou envie no body)" }, { status: 500 });
    }

    const expiracaoAt = new Date(Date.now() + 15 * 60 * 1000);

    // cria pagamento pendente
    const novo = await prisma.pagamento.create({
      data: {
        valorCent,
        descricao,
        status: "pendente",
        expiracaoAt,
        payloadPix: null,           // vamos gerar logo abaixo
        clienteIp: clienteIp || null,
        clienteMac: clienteMac || null,
      },
      select: { id: true, valorCent: true, descricao: true, status: true, expiracaoAt: true, clienteIp: true, clienteMac: true }
    });

    // gera BR Code Pix com txid = id (<=25 chars)
    const payload = gerarPixPayload({
      chave: chavePix,
      valor: (novo.valorCent || 0) / 100,
      nome: "Lopesul Wi-Fi",
      cidade: "SAO PAULO",
      txid: novo.id,
      descricao: novo.descricao,
    });

    // salva o copia-e-cola
    await prisma.pagamento.update({
      where: { id: novo.id },
      data: { payloadPix: payload }
    });

    return NextResponse.json(
      {
        id: novo.id,
        status: novo.status,
        valor: (novo.valorCent || 0) / 100,
        descricao: novo.descricao,
        expiraEm: novo.expiracaoAt,
        mac: novo.clienteMac,
        ip: novo.clienteIp,
        payload,        // copia-e-cola
        minutosLivres: minAcesso,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/pagamentos", e);
    return NextResponse.json({ error: "Não foi possível iniciar o pagamento." }, { status: 500 });
  }
}
