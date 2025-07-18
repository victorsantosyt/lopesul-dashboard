import { NextResponse } from 'next/server';
import { RouterOSClient } from 'node-routeros';

export async function POST(req) {
  try {
    const { mikrotikIp, clienteIp, tempo } = await req.json();

    if (!mikrotikIp || !clienteIp || !tempo) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const conn = new RouterOSClient({
      host: mikrotikIp,
      user: 'admin',         // substitua
      password: 'senha123',  // substitua
    });

    await conn.connect();

    // Adiciona o IP com timeout automático
    await conn.write('/ip/firewall/address-list/add', [
      '=list=acesso-liberado',
      `=address=${clienteIp}`,
      `=timeout=${tempo}m`, // tempo em minutos (ex: 120m = 2h)
      '=comment=Acesso automático com expiração'
    ]);

    await conn.close();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro ao liberar acesso:', err);
    return NextResponse.json({ error: 'Falha ao liberar acesso' }, { status: 500 });
  }
}
