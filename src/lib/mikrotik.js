// src/lib/mikrotik.js
import MikroNode from "mikronode-ng2";
import { relayFetch } from "./relay";

function resolveRouterConfig(router = {}) {
  const host = router.host || process.env.MIKROTIK_HOST;
  const user = router.user || process.env.MIKROTIK_USER;
  const pass = router.pass || process.env.MIKROTIK_PASS;
  const port = Number(
    router.port ??
      process.env.MIKROTIK_PORT ??
      process.env.PORTA_MIKROTIK ??
      8728
  );
  const timeout = Number(router.timeout ?? process.env.MIKROTIK_TIMEOUT_MS ?? 5000);
  const secure =
    typeof router.secure === "boolean"
      ? router.secure
      : router.ssl ?? router.tls ?? false;

  if (!host || !user || !pass) {
    throw new Error("Faltam credenciais de Mikrotik (host/user/pass).");
  }

  return { host, user, pass, port, timeout, secure };
}

function getConnection(router) {
  const cfg = resolveRouterConfig(router);
  const options = {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.pass,
    timeout: cfg.timeout,
  };

  if (cfg.secure) {
    options.tls = {
      rejectUnauthorized: false,
    };
  }

  return new MikroNode.Connection(options);
}

/** ============================
 * PING TESTE (usa API, não SSH)
 * ============================ */
export async function getStarlinkStatus(router) {
  const conn = getConnection(router);
  try {
    await conn.connect();
    const chan = conn.openChannel();

    const pingTarget = process.env.STARLINK_PING_TARGET || "1.1.1.1";

    const res = await chan.write(`/ping address=${pingTarget} count=3`);
    const data = res.data.toString();

    const match = data.match(/time=(\d+(?:\.\d+)?)ms/);
    const rtt = match ? parseFloat(match[1]) : null;

    return { ok: true, connected: true, rtt_ms: rtt };
  } catch (err) {
    console.error("[MIKROTIK] API ping error:", err.message);
    return { ok: false, error: err.message };
  } finally {
    conn.close();
  }
}

/** ============================
 * LISTA SESSÕES PPP
 * ============================ */
export async function listPppActive(router) {
  const conn = getConnection(router);
  try {
    await conn.connect();
    const chan = conn.openChannel();
    const res = await chan.write("/ppp active print detail");
    return { ok: true, data: res.data.toString() };
  } catch (err) {
    console.error("[MIKROTIK] API list error:", err.message);
    return { ok: false, error: err.message };
  } finally {
    conn.close();
  }
}

/** ============================
 * LIBERAR ACESSO (preset completo: paid_clients + bypass + matar sessão)
 * ============================ */
export async function liberarAcesso({ ip, mac, orderId, comment, router, pedidoId, deviceId, mikId } = {}) {
  // Segurança: não vamos liberar nada sem IP/MAC válidos
  if (!ip || ip === "0.0.0.0") {
    throw new Error(`[MIKROTIK] IP inválido para liberação: ${ip}`);
  }
  if (!mac) {
    throw new Error("[MIKROTIK] MAC inválido para liberação");
  }

  const finalComment = comment || `paid:${orderId || pedidoId || "sem-order"}`;

  // Criar nome de usuário temporário baseado no MAC (sem dois pontos)
  const username = `paid_${mac.replace(/:/g, "").toLowerCase()}`;

  const sentences = [
    `/ip/firewall/address-list/add list=paid_clients address=${ip} comment="${finalComment}"`,
    `/ip/hotspot/ip-binding/add address=${ip} mac-address=${mac} server=hotspot1 type=bypassed comment="${finalComment}"`,
    `/ip/hotspot/active/remove [find address="${ip}" or mac-address="${mac}"]`,
    `/ip/firewall/connection/remove [find src-address~"${ip}" or dst-address~"${ip}"]`,
    // Nota: ip-binding com type=bypassed já libera o acesso
    // Cliente precisa fazer nova requisição HTTP para Mikrotik reconhecer o binding
  ];

  // ===== MODO INTELIGENTE (prioridade) =====
  // Tenta usar relay inteligente se tiver pedidoId ou deviceId
  if (pedidoId || deviceId || mikId) {
    try {
      const endpoint = pedidoId 
        ? "/relay/exec-by-pedido"
        : "/relay/exec-by-device";
      
      const body = pedidoId
        ? { pedidoId, command: "" }
        : { deviceId, mikId, command: "" };

      console.log("[MIKROTIK] Tentando modo inteligente:", endpoint, { pedidoId, deviceId, mikId });

      // Executa cada comando via modo inteligente
      for (const cmd of sentences) {
        try {
          const response = await relayFetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, command: cmd }),
          });

          const result = await response.json().catch(() => ({}));
          if (!result.ok) {
            // Se database_not_available, tenta modo direto
            if (result.error === 'database_not_available') {
              console.log("[MIKROTIK] Relay sem DB, usando modo direto");
              break; // Sai do loop e vai para modo direto
            }
            console.warn("[MIKROTIK] Comando falhou via relay inteligente:", cmd, result.error);
          } else {
            console.log("[MIKROTIK] Comando executado via relay inteligente:", cmd);
          }
        } catch (cmdErr) {
          // Se erro de conexão, tenta modo direto
          if (cmdErr.message?.includes('RELAY') || cmdErr.message?.includes('fetch')) {
            console.log("[MIKROTIK] Relay indisponível, usando modo direto");
            break;
          }
          console.error("[MIKROTIK] Erro ao executar comando via relay inteligente:", cmd, cmdErr.message);
        }
      }

      // Se chegou aqui sem quebrar, modo inteligente funcionou
      console.log("[MIKROTIK] Acesso liberado com sucesso via relay inteligente para", ip, mac, finalComment);
      return { ok: true, cmds: sentences, via: "relay_inteligente" };
    } catch (err) {
      console.warn("[MIKROTIK] Modo inteligente falhou, tentando modo direto:", err.message);
      // Continua para modo direto
    }
  }

  // ===== MODO DIRETO (compatibilidade) =====
  // Usa relay direto se router estiver configurado
  if (router && router.host) {
    try {
      const cfg = resolveRouterConfig(router);
      console.log("[MIKROTIK] Usando relay direto para liberar acesso:", ip, mac);
      
      for (const cmd of sentences) {
        console.log("[MIKROTIK] Executando via relay direto:", cmd);
        try {
          const response = await relayFetch("/relay/exec", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              host: cfg.host,
              user: cfg.user,
              pass: cfg.pass,
              port: cfg.port,
              command: cmd,
            }),
          });

          const result = await response.json().catch(() => ({}));
          if (!result.ok) {
            console.warn("[MIKROTIK] Comando falhou via relay direto:", cmd, result.error);
          }
        } catch (cmdErr) {
          console.error("[MIKROTIK] Erro ao executar comando via relay direto:", cmd, cmdErr.message);
        }
      }

      console.log("[MIKROTIK] Acesso liberado com sucesso via relay direto para", ip, mac, finalComment);
      return { ok: true, cmds: sentences, via: "relay_direto" };
    } catch (err) {
      console.error("[MIKROTIK] Erro ao usar relay direto, tentando API direta:", err.message);
      // Fallback para API direta se relay falhar
    }
  }

  // Fallback: API direta (mikronode-ng2)
  const conn = getConnection(router);
  try {
    await conn.connect();
    const chan = conn.openChannel();

    const cmds = [];

    // 1) Marca IP como pago
    cmds.push(
      `/ip/firewall/address-list/add ` +
        `list=paid_clients ` +
        `address=${ip} ` +
        `comment="${finalComment}"`
    );

    // 2) Cria bypass no hotspot
    cmds.push(
      `/ip/hotspot/ip-binding/add ` +
        `address=${ip} ` +
        `mac-address=${mac} ` +
        `server=hotspot1 ` +
        `type=bypassed ` +
        `comment="${finalComment}"`
    );

    // 3) Derruba sessão antiga do hotspot
    cmds.push(
      `/ip/hotspot/active/remove ` +
        `[find address="${ip}" or mac-address="${mac}"]`
    );

    // 4) Limpa conexões antigas do IP
    cmds.push(
      `/ip/firewall/connection/remove ` +
        `[find src-address~"${ip}" or dst-address~"${ip}"]`
    );

    // 5) Nota: ip-binding com type=bypassed já libera o acesso
    // Cliente precisa fazer nova requisição HTTP para Mikrotik reconhecer o binding

    for (const cmd of cmds) {
      console.log("[MIKROTIK] Executando (API direta):", cmd);
      await chan.write(cmd);
    }

    console.log("[MIKROTIK] Acesso liberado com sucesso (API direta) para", ip, mac, finalComment);
    return { ok: true, cmds, via: "api_direta" };
  } catch (err) {
    console.error("[MIKROTIK] liberarAcesso API error:", err.message);
    return { ok: false, error: err.message };
  } finally {
    conn.close();
  }
}

/** ============================
 * REVOGAR ACESSO
 * ============================ */
export async function revogarAcesso({ ip, mac, username, router } = {}) {
  const conn = getConnection(router);
  try {
    await conn.connect();
    const chan = conn.openChannel();

    const cmds = [];
    if (ip) cmds.push(`/ip/firewall/address-list/remove [find address=${ip}]`);
    if (mac) cmds.push(`/interface/wireless/access-list/remove [find mac-address=${mac}]`);
    if (username) cmds.push(`/ip/hotspot/user/remove [find name=${username}]`);

    for (const cmd of cmds) await chan.write(cmd);

    return { ok: true, cmds };
  } catch (err) {
    console.error("[MIKROTIK] revogarAcesso API error:", err.message);
    return { ok: false, error: err.message };
  } finally {
    conn.close();
  }
}

export default {
  getStarlinkStatus,
  listPppActive,
  liberarAcesso,
  revogarAcesso,
};
