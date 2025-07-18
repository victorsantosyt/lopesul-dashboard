import { NextResponse } from 'next/server';
import { RouterOSClient } from 'node-routeros';

export async function POST(req) {
  try {
    const { mikrotikIp, id } = await req.json();

    if (!mikrotikIp || !id) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const conn = new RouterOSClient({
      host: mikrotikIp,
      user: 'admin',
      password: 'senha123'
    });

    await conn.connect();

    await conn.write('/ip/firewall/address-list/remove', [`=.id=${id}`]);

    await conn.close();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao revogar acesso:', err);
    return NextResponse.json({ error: 'Erro ao remover sessão' }, { status: 500 });
  }
}
