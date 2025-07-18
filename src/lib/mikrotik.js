// src/lib/mikrotik.js
import { RouterOSClient } from 'node-routeros';

export default async function conectarMikrotik() {
  const client = new RouterOSClient({
    host: '192.168.88.1',
    user: 'admin',
    password: ''
  });

  await client.connect();
  const response = await client.menu('/ppp/active').getAll();
  return response;
}
