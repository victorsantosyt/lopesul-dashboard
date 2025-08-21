// src/lib/mikrotik.js
import { RouterOSAPI } from 'node-routeros';

export async function listPppActive() {
  const api = new RouterOSAPI({
    host: process.env.MIKROTIK_HOST || '192.168.88.1',
    user: process.env.MIKROTIK_USER || 'admin',
    password: process.env.MIKROTIK_PASS || '',
    timeout: 5000,
  });

  let client;
  try {
    client = await api.connect();                // abre sessão
    const rows = await client.menu('/ppp/active').getAll(); // consulta
    return rows;                                 // [{ name, address, ... }]
  } finally {
    try { await client?.close(); } catch {}      // fecha sessão com segurança
  }
}
