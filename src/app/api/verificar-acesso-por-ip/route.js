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

    // Aceitar MAC via query parameter (para verificação por MAC também)
    const macParam = req.nextUrl.searchParams.get("mac");
    const mac = macParam ? macParam.trim().toUpperCase() : null;

    // Aceitar pedidoCode via query parameter ou cookie (para identificar cliente mesmo quando IP/MAC mudam)
    const pedidoCodeParam = req.nextUrl.searchParams.get("pedidoCode");
    const cookieHeader = req.headers.get("cookie") || "";
    const pedidoCodeCookie = cookieHeader.match(/pedidoCode=([^;]+)/)?.[1];
    const pedidoCode = pedidoCodeParam || pedidoCodeCookie || null;

    // Aceitar deviceId/mikId via query parameter (para buscar pedidos do mesmo dispositivo)
    const deviceIdParam = req.nextUrl.searchParams.get("deviceId");
    const mikIdParam = req.nextUrl.searchParams.get("mikId");

    if (!ip || ip === "unknown" || ip === "127.0.0.1") {
      return NextResponse.json({ 
        temAcesso: false, 
        motivo: "IP não identificado" 
      });
    }

    console.log('[verificar-acesso-por-ip] Verificando acesso para IP:', ip, mac ? `MAC: ${mac}` : '', pedidoCode ? `PedidoCode: ${pedidoCode}` : '');

    // Verificar se há pedido PAGO recente (últimas 3 horas) para aquele IP
    const tresHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000);
    
    // Estratégia de busca MULTIPLA para casos de IP/MAC aleatório:
    // 1. Buscar por IP exato
    // 2. Buscar por MAC (se fornecido)
    // 3. Buscar por pedidoCode (cookie/query) - CRUCIAL para MAC aleatório
    // 4. Buscar por IPs na mesma subnet (192.168.88.X) - ajuda quando IP muda
    const whereClause = {
      status: "PAID",
      createdAt: {
        gte: tresHorasAtras,
      },
      OR: [
        { ip: ip },
      ],
    };

    // Se tiver MAC, também buscar por MAC (mesmo que IP tenha mudado)
    if (mac) {
      whereClause.OR.push({ deviceMac: mac.toUpperCase() });
    }

    // Se tiver pedidoCode (cookie ou query), buscar por código do pedido
    // Isso é CRUCIAL para casos de MAC aleatório - identifica o cliente mesmo quando IP/MAC mudam
    if (pedidoCode) {
      whereClause.OR.push({ code: pedidoCode });
    }

    // Se tiver deviceId ou mikId, buscar pedidos pagos do mesmo dispositivo
    // Isso ajuda quando IP/MAC mudam mas o dispositivo é o mesmo
    if (deviceIdParam) {
      whereClause.OR.push({ deviceId: deviceIdParam });
    }
    if (mikIdParam) {
      // Buscar pedidos que têm device com esse mikId
      whereClause.OR.push({
        device: {
          mikId: mikIdParam,
        },
      });
    }

    // Se o IP for da subnet 192.168.88.X, buscar também por outros IPs na mesma subnet
    // Isso ajuda quando o IP muda mas ainda está na mesma rede
    // IMPORTANTE: Esta busca é mais ampla, então só fazemos se não tiver encontrado por outras formas
    if (ip && ip.startsWith("192.168.88.") && !pedidoCode && !deviceIdParam && !mikIdParam) {
      whereClause.OR.push({
        ip: {
          startsWith: "192.168.88.",
        },
      });
    }

    const pedidoPago = await prisma.pedido.findFirst({
      where: whereClause,
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
        ipPedido: pedidoPago.ip,
        macPedido: pedidoPago.deviceMac,
        ipAtual: ip,
        macAtual: mac,
      });

      // Se o IP ou MAC mudaram, liberar automaticamente o novo IP/MAC
      const ipMudou = pedidoPago.ip && pedidoPago.ip !== ip;
      const macMudou = pedidoPago.deviceMac && mac && pedidoPago.deviceMac.toUpperCase() !== mac.toUpperCase();
      
      if (ipMudou || macMudou) {
        console.log('[verificar-acesso-por-ip] 🔄 IP ou MAC mudou, liberando automaticamente...', {
          ipAnterior: pedidoPago.ip,
          ipNovo: ip,
          macAnterior: pedidoPago.deviceMac,
          macNovo: mac,
        });
        
        try {
          // Importar liberarAcesso dinamicamente para evitar dependência circular
          const { liberarAcesso } = await import("@/lib/mikrotik");
          
          // Buscar informações do dispositivo para o modo inteligente
          const { requireDeviceRouter } = await import("@/lib/device-router");
          let routerInfo = null;
          
          try {
            routerInfo = await requireDeviceRouter({
              deviceId: pedidoPago.deviceId,
              mikId: pedidoPago.device?.mikId || pedidoPago.deviceIdentifier,
            });
          } catch (err) {
            console.warn('[verificar-acesso-por-ip] Dispositivo não encontrado, usando modo direto:', err.message);
          }
          
          // Liberar acesso com o novo IP/MAC
          await liberarAcesso({
            ip,
            mac: mac || pedidoPago.deviceMac, // Usa MAC atual ou do pedido
            orderId: pedidoPago.code,
            pedidoId: pedidoPago.id,
            deviceId: pedidoPago.deviceId,
            mikId: routerInfo?.device?.mikId,
            comment: `auto-liberado:${pedidoPago.code}`,
            router: routerInfo?.router,
          });
          
          console.log('[verificar-acesso-por-ip] ✅ Acesso liberado automaticamente para novo IP/MAC');
        } catch (err) {
          console.error('[verificar-acesso-por-ip] Erro ao liberar acesso automaticamente:', err.message);
          // Continua mesmo se falhar, retorna que tem acesso
        }
      }

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
        liberadoAutomaticamente: ipMudou || macMudou,
      });
    }

    // Também verificar se há sessão ativa para aquele IP ou MAC (mesmo sem pedido recente)
    const sessaoWhere = {
      ativo: true,
      expiraEm: {
        gte: new Date(),
      },
      OR: [
        { ipCliente: ip },
      ],
    };

    // Se tiver MAC, também buscar por MAC
    if (mac) {
      sessaoWhere.OR.push({ macCliente: mac });
    }

    // Se tiver pedidoCode, também buscar sessões ativas por pedidoId
    if (pedidoCode) {
      const pedidoPorCode = await prisma.pedido.findFirst({
        where: { code: pedidoCode },
        select: { id: true },
      });
      if (pedidoPorCode) {
        sessaoWhere.OR.push({ pedidoId: pedidoPorCode.id });
      }
    }

    const sessaoAtivaPorIp = await prisma.sessaoAtiva.findFirst({
      where: sessaoWhere,
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

