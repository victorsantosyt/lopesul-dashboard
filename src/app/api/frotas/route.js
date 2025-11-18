// src/app/api/frotas/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAnyOnline, checkStarlink } from '@/lib/netcheck';
import { relayFetch } from '@/lib/relay';

export const dynamic = 'force-dynamic';

const DAYS = 7;

function pickIp(row) {
  return row?.ip ?? row?.enderecoIp ?? row?.ipAddress ?? row?.host ?? null;
}

export async function GET() {
  try {
    const since = new Date();
    since.setDate(since.getDate() - DAYS);

    const user = process.env.MIKROTIK_USER || '';
    const pass = process.env.MIKROTIK_PASS || '';

    // Busca frotas com dispositivos, vendas recentes e roteador vinculado
    const frotas = await prisma.frota.findMany({
      orderBy: { nome: 'asc' },
      include: {
        dispositivos: true,
        vendas: {
          where: { data: { gte: since } },
          select: { valorCent: true },
        },
        roteador: {
          select: {
            id: true,
            nome: true,
            ipLan: true,
            statusMikrotik: true,
            statusWireguard: true,
          },
        },
      },
    });

    // Para cada frota (ônibus), checa status Mikrotik/Starlink com base nos IPs cadastrados
    const resposta = await Promise.all(
      (frotas ?? []).map(async (f) => {
        const ips = (f.dispositivos ?? []).map(pickIp).filter(Boolean);

        let mk = { online: false, lastHost: null };
        let sl = { online: false, lastHost: null };
        let mikrotikIdentity = null;

        if (ips.length > 0) {
          try {
            mk = await checkAnyOnline(ips);
          } catch (e) {
            console.warn('checkAnyOnline falhou para frota', f.id, e?.message || e);
          }

          try {
            sl = await checkStarlink(ips);
          } catch (e) {
            console.warn('checkStarlink falhou para frota', f.id, e?.message || e);
          }

          // Se o Mikrotik desta frota estiver online e tivermos credenciais, tenta obter o identity
          if (mk.online && mk.lastHost && user && pass) {
            try {
              const r = await relayFetch('/relay/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  host: mk.lastHost,
                  user,
                  pass,
                  command: '/system/identity/print',
                }),
              }).catch(() => null);

              const j = await r?.json().catch(() => null);
              const rows = Array.isArray(j?.data) ? j.data : [];
              if (rows[0]?.name) {
                mikrotikIdentity = rows[0].name;
              }
            } catch (e) {
              console.warn('identity fetch falhou para frota', f.id, e?.message || e);
            }
          }
        }

        const receitaCentavos = (f.vendas ?? []).reduce(
          (acc, v) => acc + (Number(v?.valorCent) || 0),
          0
        );

        return {
          id: f.id,
          nome: f.nome ?? `Frota ${f.id.slice(0, 4)}`,
          acessos: (f.dispositivos ?? []).length,
          // Mantém compatibilidade com a tela atual: "Status Mikrotik" usa `status`
          status: mk.online ? 'online' : 'offline',
          statusMikrotik: mk.online ? 'online' : 'offline',
          statusStarlink: sl.online ? 'online' : 'offline',
          mikrotikHost: mk.lastHost ?? null,
          starlinkHost: sl.lastHost ?? null,
          mikrotikIdentity,
          pingMs: null,
          perdaPct: null,
          valorTotal: Number(receitaCentavos / 100),
          valorTotalCentavos: Number(receitaCentavos),
          periodoDias: DAYS,
          // Dados do Roteador vinculado (se houver)
          roteadorId: f.roteadorId ?? null,
          roteadorNome: f.roteador?.nome ?? null,
          roteadorIpLan: f.roteador?.ipLan ?? null,
          roteadorStatusMikrotik: f.roteador?.statusMikrotik ?? null,
          roteadorStatusWireguard: f.roteador?.statusWireguard ?? null,
        };
      })
    );

    // A tela de /frotas espera um array simples; retornamos direto a lista
    return NextResponse.json(resposta, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('GET /api/frotas erro geral:', error);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: String(error) },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
