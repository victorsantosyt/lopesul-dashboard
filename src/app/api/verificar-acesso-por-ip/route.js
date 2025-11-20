// src/app/api/verificar-acesso-por-ip/route.js
// Verifica se há pedido PAGO recente para aquele IP
// Resolve problema de MAC aleatório - cliente já pagou mas MAC mudou
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    // Obter IP do cliente (priorizar headers do Mikrotik)
    const forwarded = req.headers.get("x-forwarded-for");
    const realIp = req.headers.get("x-real-ip");
    const cfConnectingIp = req.headers.get("cf-connecting-ip");
    const mikrotikIp = req.headers.get("x-mikrotik-ip") ||
                       req.headers.get("x-client-ip") ||
                       req.headers.get("x-original-ip") ||
                       null;
    
    let ip = mikrotikIp || realIp || cfConnectingIp || forwarded?.split(",")[0]?.trim() || "unknown";
    
    // Se tiver x-forwarded-for, tentar encontrar IP local
    if (forwarded && !ip.startsWith("192.168.") && !ip.startsWith("10.") && !ip.startsWith("172.")) {
      const ips = forwarded.split(",").map(i => i.trim());
      const localIp = ips.find(i => 
        i.startsWith("192.168.") || 
        i.startsWith("10.") || 
        (i.startsWith("172.") && parseInt(i.split(".")[1]) >= 16 && parseInt(i.split(".")[1]) <= 31)
      );
      if (localIp) {
        ip = localIp;
      }
    }

    // Também aceitar IP via query parameter (fallback)
    const ipParam = req.nextUrl.searchParams.get("ip");
    if (ipParam && (ipParam.startsWith("192.168.") || ipParam.startsWith("10.") || ipParam.startsWith("172."))) {
      ip = ipParam;
    }

    if (!ip || ip === "unknown" || ip === "127.0.0.1") {
      return NextResponse.json({ 
        temAcesso: false, 
        motivo: "IP não identificado" 
      });
    }

    console.log('[verificar-acesso-por-ip] Verificando acesso para IP:', ip);

    // Verificar se há pedido PAGO recente (últimas 3 horas) para aquele IP
    const tresHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000);
    
    const pedidoPago = await prisma.pedido.findFirst({
      where: {
        ip: ip,
        status: "PAID",
        createdAt: {
          gte: tresHorasAtras,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        SessaoAtiva: {
          where: {
            ativo: true,
            expiraEm: {
              gte: new Date(),
            },
          },
          take: 1,
        },
      },
    });

    if (pedidoPago) {
      console.log('[verificar-acesso-por-ip] ✅ Pedido pago encontrado:', {
        pedidoId: pedidoPago.id,
        code: pedidoPago.code,
        createdAt: pedidoPago.createdAt,
        temSessaoAtiva: pedidoPago.SessaoAtiva.length > 0,
      });

      // Verificar se há sessão ativa
      const sessaoAtiva = pedidoPago.SessaoAtiva[0];
      
      return NextResponse.json({
        temAcesso: true,
        pedidoId: pedidoPago.id,
        pedidoCode: pedidoPago.code,
        createdAt: pedidoPago.createdAt,
        temSessaoAtiva: !!sessaoAtiva,
        sessaoId: sessaoAtiva?.id || null,
        expiraEm: sessaoAtiva?.expiraEm || null,
      });
    }

    // Também verificar se há sessão ativa para aquele IP (mesmo sem pedido recente)
    const sessaoAtivaPorIp = await prisma.sessaoAtiva.findFirst({
      where: {
        ipCliente: ip,
        ativo: true,
        expiraEm: {
          gte: new Date(),
        },
      },
      orderBy: {
        expiraEm: "desc",
      },
    });

    if (sessaoAtivaPorIp) {
      console.log('[verificar-acesso-por-ip] ✅ Sessão ativa encontrada:', {
        sessaoId: sessaoAtivaPorIp.id,
        expiraEm: sessaoAtivaPorIp.expiraEm,
      });

      return NextResponse.json({
        temAcesso: true,
        temSessaoAtiva: true,
        sessaoId: sessaoAtivaPorIp.id,
        expiraEm: sessaoAtivaPorIp.expiraEm,
        pedidoId: sessaoAtivaPorIp.pedidoId,
      });
    }

    console.log('[verificar-acesso-por-ip] ❌ Nenhum acesso encontrado para IP:', ip);

    return NextResponse.json({
      temAcesso: false,
      motivo: "Nenhum pedido pago recente ou sessão ativa encontrada",
    });

  } catch (error) {
    console.error('[verificar-acesso-por-ip] Erro:', error);
    return NextResponse.json(
      { 
        temAcesso: false, 
        erro: error.message 
      },
      { status: 500 }
    );
  }
}

