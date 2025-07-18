import conectarMikrotik from '@/lib/mikrotik';

export async function GET() {
  try {
    const sessoes = await conectarMikrotik();
    return new Response(JSON.stringify(sessoes), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro ao obter sessões:', error);
    return new Response(JSON.stringify({ error: 'Erro ao obter sessões do Mikrotik' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
