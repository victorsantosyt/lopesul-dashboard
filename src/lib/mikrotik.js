// src/lib/mikrotik.js
import MikroNode from "mikronode-ng2";

function getConnection() {
  const host = process.env.MIKROTIK_HOST;
  const port = Number(process.env.MIKROTIK_PORT || 8728);
  const user = process.env.MIKROTIK_USER;
  const pass = process.env.MIKROTIK_PASS;

  if (!host || !user || !pass) {
    throw new Error("Faltam variáveis de ambiente: MIKROTIK_HOST/USER/PASS");
  }

  return new MikroNode.Connection({
    host,
    port,
    user,
    password: pass,
    timeout: 5000,
  });
}

/** ============================
 * PING TESTE (usa API, não SSH)
 * ============================ */
export async function getStarlinkStatus() {
  const conn = getConnection();
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
export async function listPppActive() {
  const conn = getConnection();
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
 * LIBERAR ACESSO
 * ============================ */
export async function liberarAcesso({ ip, mac, username, comment = "painel" } = {}) {
  const conn = getConnection();
  try {
    await conn.connect();
    const chan = conn.openChannel();

    const cmds = [];
    if (ip) cmds.push(`/ip/firewall/address-list/add list=paid_clients address=${ip} comment="${comment}"`);
    if (mac) cmds.push(`/interface/wireless/access-list/add mac-address=${mac} comment="${comment}"`);
    if (username) cmds.push(`/ip/hotspot/user/add name=${username} password=${username}`);

    for (const cmd of cmds) await chan.write(cmd);

    return { ok: true, cmds };
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
export async function revogarAcesso({ ip, mac, username } = {}) {
  const conn = getConnection();
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
