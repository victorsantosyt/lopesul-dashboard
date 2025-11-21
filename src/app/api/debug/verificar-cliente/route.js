// src/app/api/debug/verificar-cliente/route.js
// Endpoint temporário para verificar status de um cliente específico

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const mac = url.searchParams.get('mac');
    const ip = url.searchParams.get('ip');

    if (!mac && !ip) {
      return NextResponse.json(
        { error: 'Forneça MAC ou IP como parâmetro' },
        { status: 400 }
      );
    }

    const where = {};
    if (mac) {
      where.OR = [{ deviceMac: { equals: mac, mode: 'insensitive' } }];
    }
    if (ip) {
      where.OR = where.OR || [];
      where.OR.push({ ip });
    }

    // 1. Buscar pedidos
    const pedidos = await prisma.pedido.findMany({
      where,
      include: {
        device: {
          select: {
            id: true,
            mikId: true,
            ip: true,
            mikrotikHost: true,
          },
        },
        charges: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        SessaoAtiva: {
          where: { ativo: true },
          take: 1,
          include: {
            roteador: {
              select: {
                nome: true,
                ipLan: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 2. Buscar sessões ativas
    const sessaoWhere = { ativo: true };
    if (mac || ip) {
      sessaoWhere.OR = [];
      if (mac) sessaoWhere.OR.push({ macCliente: { equals: mac, mode: 'insensitive' } });
      if (ip) sessaoWhere.OR.push({ ipCliente: ip });
    }

    const sessoes = await prisma.sessaoAtiva.findMany({
      where: sessaoWhere,
      include: {
        pedido: {
          select: {
            id: true,
            code: true,
            status: true,
            amount: true,
          },
        },
        roteador: {
          select: {
            nome: true,
            ipLan: true,
          },
        },
      },
      orderBy: { inicioEm: 'desc' },
    });

    // 3. Pedidos recentes pagos na mesma rede (últimas 6h)
    const agora = new Date();
    const seisHorasAtras = new Date(agora.getTime() - 6 * 60 * 60 * 1000);
    
    let subnet = null;
    if (ip) {
      const parts = ip.split('.');
      if (parts.length >= 3) {
        subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
      }
    }

    const pedidosRecentes = subnet
      ? await prisma.pedido.findMany({
          where: {
            status: 'PAID',
            createdAt: { gte: seisHorasAtras },
            ip: { startsWith: subnet },
          },
          select: {
            id: true,
            code: true,
            ip: true,
            deviceMac: true,
            status: true,
            createdAt: true,
            device: {
              select: {
                mikId: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      : [];

    // 4. Dispositivos na mesma rede
    const dispositivos = subnet
      ? await prisma.dispositivo.findMany({
          where: {
            ip: { startsWith: subnet },
          },
          select: {
            id: true,
            mikId: true,
            ip: true,
            mikrotikHost: true,
          },
        })
      : [];

    return NextResponse.json({
      ok: true,
      consulta: { mac, ip },
      pedidos: pedidos.map((p) => ({
        id: p.id,
        code: p.code,
        status: p.status,
        amount: p.amount,
        createdAt: p.createdAt.toISOString(),
        ip: p.ip,
        deviceMac: p.deviceMac,
        deviceId: p.deviceId,
        deviceMikId: p.device?.mikId,
        deviceHost: p.device?.mikrotikHost,
        temSessaoAtiva: p.SessaoAtiva && p.SessaoAtiva.length > 0,
        sessaoAtiva: p.SessaoAtiva?.[0]
          ? {
              id: p.SessaoAtiva[0].id,
              ipCliente: p.SessaoAtiva[0].ipCliente,
              macCliente: p.SessaoAtiva[0].macCliente,
              expiraEm: p.SessaoAtiva[0].expiraEm.toISOString(),
              roteador: p.SessaoAtiva[0].roteador?.nome || p.SessaoAtiva[0].roteador?.ipLan,
              expirado: p.SessaoAtiva[0].expiraEm < agora,
            }
          : null,
        charge: p.charges?.[0]
          ? {
              status: p.charges[0].status,
              createdAt: p.charges[0].createdAt.toISOString(),
            }
          : null,
      })),
      sessoesAtivas: sessoes.map((s) => ({
        id: s.id,
        ipCliente: s.ipCliente,
        macCliente: s.macCliente,
        inicioEm: s.inicioEm.toISOString(),
        expiraEm: s.expiraEm.toISOString(),
        expirado: s.expiraEm < agora,
        pedidoCode: s.pedido?.code,
        roteador: s.roteador?.nome || s.roteador?.ipLan,
      })),
      pedidosRecentesRede: pedidosRecentes.map((p) => ({
        code: p.code,
        ip: p.ip,
        deviceMac: p.deviceMac,
        mikId: p.device?.mikId,
        createdAt: p.createdAt.toISOString(),
      })),
      dispositivosRede: dispositivos.map((d) => ({
        mikId: d.mikId,
        ip: d.ip,
        mikrotikHost: d.mikrotikHost,
      })),
    });
  } catch (error) {
    console.error('[debug/verificar-cliente] Erro:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

