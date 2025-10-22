// src/app/api/dispositivos/ping/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const TIMEOUT_MS = 2000;    // timeout curto por host
const CONCURRENCY = 10;     // limita paralelismo

function normalizeUrl(ip) {
  if (!ip) return null;
  let s = String(ip).trim();
  // se já veio http/https, usa como está
  if (/^https?:\/\//i.test(s)) return s;
  // IPv6 precisa de colchetes no host
  if (s.includes(':') && !s.startsWith('[')) s = `[${s}]`;
  return `http://${s}`;
}

// Promise pool minimalista
async function mapLimit(items, limit, worker) {
  const ret = [];
  let i = 0;
  let active = 0;
  return await new Promise((resolve, reject) => {
    const next = () => {
      if (i >= items.length && active === 0) return resolve(ret);
      while (active < limit && i < items.length) {
        const idx = i++;
        active++;
        Promise.resolve(worker(items[idx], idx))
          .then((val) => { ret[idx] = val; })
          .catch((err) => { ret[idx] = { error: String(err?.message || err) }; })
          .finally(() => { active--; next(); });
      }
    };
    next();
  });
}

async function httpCheck(url) {
  if (!url) return 'unknown';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // tenta HEAD primeiro (mais leve); se 405/403, cai pra GET
    let res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    if (!res.ok && res.status !== 405 && res.status !== 403) {
      // alguns devices só respondem ao GET /
      res = await fetch(url, { method: 'GET', signal: ctrl.signal });
    }
    return res.ok ? 'online' : 'offline';
  } catch {
    return 'offline';
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const save = url.searchParams.get('save') === '1';

    // busca tudo; alguns esquemas têm ip/enderecoIp — não arrisque SELECT parcial
    const dispositivos = await prisma.dispositivo.findMany();

    // checagem em paralelo com limite
    const resultados = await mapLimit(dispositivos, CONCURRENCY, async (d) => {
      const ipRaw =
        d?.ip ??
        d?.enderecoIp ??
        d?.ipAddress ??
        d?.host ??
        null;

      const url = normalizeUrl(ipRaw);
      const status = await httpCheck(url);

      if (save) {
        // atualiza "status" se existir a coluna — se não existir, isso vai falhar; tratamos silencioso
        try {
          await prisma.dispositivo.update({
            where: { id: d.id },
            data: { status },
          });
        } catch (e) {
          // coluna ausente ou constraint — apenas reporta
          return { ...d, status, _warn: 'status not persisted' };
        }
      }

      return { ...d, status };
    });

    return NextResponse.json(
      {
        ok: true,
        count: resultados.length,
        saved: save,
        devices: resultados,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('Erro ao pingar dispositivos:', err?.message || err);
    return NextResponse.json({ ok: false, error: 'Erro interno' }, { status: 500 });
  }
}
