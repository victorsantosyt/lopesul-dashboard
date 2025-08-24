// src/lib/mikrotik.js
import { RouterOSClient } from "node-routeros";

/**
 * ENV necessários:
 *  - MKT_HOST, MKT_USER, MKT_PASS
 * Opcionais:
 *  - MKT_PORT=8728, MKT_SSL=false
 *  - MKT_LIST=paid_clients
 *  - MKT_TIMEOUT=4h
 */

function getClient() {
  const host = process.env.MKT_HOST;
  const user = process.env.MKT_USER;
  const pass = process.env.MKT_PASS;
  const port = Number(process.env.MKT_PORT || 8728);
  const useTLS = String(process.env.MKT_SSL || "false").toLowerCase() === "true";

  if (!host || !user || !pass) {
    throw new Error("Mikrotik env vars ausentes (MKT_HOST, MKT_USER, MKT_PASS).");
  }

  return new RouterOSClient({
    host,
    user,
    password: pass,
    port,
    tls: useTLS,
    timeout: 7000,
  });
}

const LIST_NAME = (process.env.MKT_LIST || "paid_clients").trim();

/** Remove entradas antigas de um IP em uma address-list */
async function removeExisting(conn, list, ip) {
  if (!ip) return;
  const existentes = await conn.write("/ip/firewall/address-list/print", {
    ".proplist": ".id",
    list,
    address: ip,
  });
  for (const e of existentes || []) {
    if (e[".id"]) {
      await conn.write("/ip/firewall/address-list/remove", { ".id": e[".id"] });
    }
  }
}

/** Tenta descobrir o IP por MAC usando ARP / Hotspot / PPP Active */
async function resolveIpByMac(conn, macRaw) {
  if (!macRaw) return null;
  const mac = String(macRaw).toLowerCase();

  // 1) ARP
  try {
    const arp = await conn.write("/ip/arp/print", { "where": [`mac-address=${mac}`] });
    const ip = arp?.[0]?.address;
    if (ip) return ip;
  } catch {}

  // 2) Hotspot active
  try {
    const hs = await conn.write("/ip/hotspot/active/print", { "where": [`mac-address=${mac}`] });
    const ip = hs?.[0]?.address;
    if (ip) return ip;
  } catch {}

  // 3) PPP active
  try {
    const ppp = await conn.write("/ppp/active/print");
    const hit = (ppp || []).find((x) => (x["caller-id"] || "").toLowerCase() === mac);
    if (hit?.address) return hit.address;
  } catch {}

  return null;
}

/**
 * Adiciona o cliente na address-list com timeout (ex.: "30m", "4h", "1d").
 * - Se não vier IP mas vier MAC, tenta resolver IP no roteador.
 */
export async function liberarCliente({ ip, mac, comentario, timeout }) {
  const api = getClient();
  let conn;
  try {
    conn = await api.connect();

    let finalIp = ip;
    if (!finalIp && mac) {
      finalIp = await resolveIpByMac(conn, mac);
    }
    if (!finalIp) {
      return { ok: false, skipped: true, reason: "Sem IP. Não foi possível resolver por MAC." };
    }

    // Remove entradas antigas para o mesmo IP
    await removeExisting(conn, LIST_NAME, finalIp);

    const comment =
      (comentario || (mac ? `mac:${mac}` : "liberado")).toString().slice(0, 120);

    const res = await conn.write("/ip/firewall/address-list/add", {
      list: LIST_NAME,
      address: finalIp,
      comment,
      ...(timeout ? { timeout } : (process.env.MKT_TIMEOUT ? { timeout: process.env.MKT_TIMEOUT } : {})),
    });

    return { ok: true, added: { ip: finalIp, list: LIST_NAME, timeout: timeout || process.env.MKT_TIMEOUT || null }, raw: res };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    try { await conn?.close(); } catch {}
  }
}

/** Remove imediatamente o IP da address-list */
export async function revogarCliente({ ip, mac }) {
  const api = getClient();
  let conn;
  try {
    conn = await api.connect();

    let finalIp = ip;
    if (!finalIp && mac) {
      finalIp = await resolveIpByMac(conn, mac);
    }
    if (!finalIp) {
      return { ok: false, skipped: true, reason: "Sem IP. Não foi possível resolver por MAC." };
    }

    await removeExisting(conn, LIST_NAME, finalIp);
    return { ok: true, removed: finalIp, list: LIST_NAME };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    try { await conn?.close(); } catch {}
  }
}
