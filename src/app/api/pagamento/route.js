import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/** mantém sua regra de mapeamento de plano */
function extrairPlano(descricao = '') {
  const d = (descricao || '').toLowerCase();
  if (d.includes('12h')) return '12h';
  if (d.includes('24h')) return '24h';
  if (d.includes('48h')) return '48h';
  return '12h';
}

/** gerador EMV Pix (copia-e-cola) – mock (troca depois pelo PSP real) */
function gerarPayloadPix({ chave, nome, cidade, valor, descricao }) {
  const sanitize = (s) =>
    (s || '')
      .toString()
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '');

  chave = sanitize(chave);
  nome = sanitize(nome);
  cidade = sanitize(cidade);
  descricao = sanitize(descricao);

  const merchantAccount = `0014BR.GOV.BCB.PIX01${String(chave.length).padStart(2, '0')}${chave}`;
  const campo26 = `26${String(merchantAccount.length).padStart(2, '0')}${merchantAccount}`;
  const campo54 = `54${String(valor.length).padStart(2, '0')}${valor}`;
  const campo59 = `59${String(nome.length).padStart(2, '0')}${nome}`;
  const campo60 = `60${String(cidade.length).padStart(2, '0')}${cidade}`;
  const campo62 = `62070503***`;

  const partes = ['000201', campo26, '52040000', '5303986', campo54, '5802BR', campo59, campo60, campo62];
  const semCRC = partes.join('');
  const crc = crc16(semCRC + '6304');
  return semCRC + '6304' + crc;
}

function crc16(str) {
  let pol = 0x1021,
    res = 0xffff;
  for (let i = 0; i < str.length; i++) {
    res ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      res = res & 0x8000 ? (res << 1) ^ pol : res << 1;
      res &= 0xffff;
    }
  }
  return res.toString(16).toUpperCase().padStart(4, '0');
}

/** CORS opcional (útil se o front rodar em domínio separado) */
function corsJson(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      // ajuste se quiser restringir:
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function OPTIONS() {
  return corsJson({});
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { valor, descricao, payload, ip, mac, roteador } = body || {};

    if (valor == null || !descricao) {
      return corsJson({ error: 'Valor e descrição são obrigatórios' }, 400);
    }

    const valorNum = Number(valor);
    if (Number.isNaN(valorNum)) {
      return corsJson({ error: 'Valor inválido' }, 400);
    }

    const brl = valorNum.toFixed(2);

    // 1) Tenta reaproveitar pagamento pendente semelhante
    const existente = await prisma.pagamento.findFirst({
      where: {
        valor: valorNum,
        descricao,
        status: 'pendente',
        // se quiser “prender” por cliente, descomente:
        // mac: mac ?? undefined,
        // ip: ip ?? undefined,
      },
      orderBy: { criadoEm: 'desc' },
    });

    if (existente) {
      // se não tiver payload salvo, gera um agora
      let copiaCola = existente.payload;
      if (!copiaCola) {
        const chave = process.env.PIX_CHAVE || 'fsolucoes1@hotmail.com';
        const nome = process.env.PIX_NOME || 'LOPESUL WIFI';
        const cidade = process.env.PIX_CIDADE || 'BRASIL';
        copiaCola = gerarPayloadPix({ chave, nome, cidade, valor: brl, descricao: descricao.slice(0, 25) });

        await prisma.pagamento.update({
          where: { id: existente.id },
          data: { payload: copiaCola },
        });
      }

      // usamos o próprio ID como "txid" (não exige alterar seu schema)
      return corsJson({
        success: true,
        txid: existente.id,
        pixCopiaCola: copiaCola,
        pagamento: existente,
      });
    }

    // 2) Gera copia-e-cola (se não vier pronto do front)
    const pixCopiaCola =
      payload ||
      gerarPayloadPix({
        chave: process.env.PIX_CHAVE || 'fsolucoes1@hotmail.com',
        nome: process.env.PIX_NOME || 'LOPESUL WIFI',
        cidade: process.env.PIX_CIDADE || 'BRASIL',
        valor: brl,
        descricao: descricao.slice(0, 25),
      });

    // 3) Cria novo pagamento pendente
    const pagamento = await prisma.pagamento.create({
      data: {
        valor: valorNum,
        descricao,
        chavePix: process.env.PIX_CHAVE || 'fsolucoes1@hotmail.com',
        payload: pixCopiaCola,
        plano: extrairPlano(descricao),
        status: 'pendente',
        ip: ip || null,
        mac: mac || null,
        roteador: roteador || null,
      },
    });

    // retorna o ID como txid + o copia-e-cola pro front
    return corsJson({
      success: true,
      txid: pagamento.id,
      pixCopiaCola,
      pagamento,
    });
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    return corsJson({ success: false, error: 'Erro ao registrar pagamento' }, 500);
  }
}
