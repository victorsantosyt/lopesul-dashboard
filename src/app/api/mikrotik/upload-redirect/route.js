// API para fazer upload do redirect.html para o MikroTik via fetch
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const RELAY_URL = process.env.RELAY_URL || 'http://localhost:3001';
    const RELAY_TOKEN = process.env.RELAY_TOKEN;

    if (!RELAY_TOKEN) {
      return NextResponse.json({ ok: false, error: 'RELAY_TOKEN not configured' }, { status: 500 });
    }

    // HTML do redirect com variáveis MikroTik
    const redirectHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Redirecionando...</title>
<meta http-equiv="refresh" content="0; url=https://cativo.lopesuldashboardwifi.com/?mac=$(mac)&ip=$(ip)">
</head>
<body>
<script>
var mac = "$(mac)";
var ip = "$(ip)";
if (mac && ip) {
  window.location.href = "https://cativo.lopesuldashboardwifi.com/?mac=" + encodeURIComponent(mac) + "&ip=" + encodeURIComponent(ip);
} else {
  window.location.href = "https://cativo.lopesuldashboardwifi.com/";
}
</script>
<p style="text-align:center;font-family:sans-serif;margin-top:50px;">
Redirecionando para o portal de pagamento...<br>
<small>Aguarde</small>
</p>
</body>
</html>`;

    // Encodar em base64 para o MikroTik
    const base64Content = Buffer.from(redirectHtml).toString('base64');

    // Comando para criar o arquivo via MikroTik API
    // Usaremos /file/set para criar o arquivo diretamente
    const sentences = [
      ['/tool/fetch', `=url=https://painel.lopesuldashboardwifi.com/redirect.html`, '=dst-path=hotspot4/redirect.html']
    ];

    console.log('[Upload Redirect] Tentando fetch do arquivo via MikroTik...');

    const response = await fetch(`${RELAY_URL}/relay/exec2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-relay-token': RELAY_TOKEN,
      },
      body: JSON.stringify({ sentences }),
    });

    const result = await response.json();
    console.log('[Upload Redirect] Resposta do relay:', result);

    if (!result.ok) {
      // Tentar método alternativo: criar arquivo via /file/print e edição
      console.log('[Upload Redirect] Método fetch falhou, tentando método direto...');
      
      // Primeiro, verificar se o arquivo já existe
      const checkSentences = [['/file/print', '?name=hotspot4/redirect.html']];
      const checkResponse = await fetch(`${RELAY_URL}/relay/exec2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-relay-token': RELAY_TOKEN,
        },
        body: JSON.stringify({ sentences: checkSentences }),
      });

      const checkResult = await checkResponse.json();
      console.log('[Upload Redirect] Verificação de arquivo existente:', checkResult);

      return NextResponse.json({
        ok: false,
        error: 'Upload via fetch falhou. Será necessário upload manual via WinBox.',
        details: result,
        instruction: 'Conecte via WinBox, vá em Files, navegue até hotspot4/ e faça upload do arquivo redirect.html',
        file_content: redirectHtml,
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Arquivo redirect.html enviado para o MikroTik com sucesso!',
      path: 'hotspot4/redirect.html',
      details: result,
    });

  } catch (error) {
    console.error('[Upload Redirect] Erro:', error);
    return NextResponse.json({
      ok: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function GET() {
  // Retorna o conteúdo do redirect.html para visualização/download
  const redirectHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Redirecionando...</title>
<meta http-equiv="refresh" content="0; url=https://cativo.lopesuldashboardwifi.com/?mac=$(mac)&ip=$(ip)">
</head>
<body>
<script>
var mac = "$(mac)";
var ip = "$(ip)";
if (mac && ip) {
  window.location.href = "https://cativo.lopesuldashboardwifi.com/?mac=" + encodeURIComponent(mac) + "&ip=" + encodeURIComponent(ip);
} else {
  window.location.href = "https://cativo.lopesuldashboardwifi.com/";
}
</script>
<p style="text-align:center;font-family:sans-serif;margin-top:50px;">
Redirecionando para o portal de pagamento...<br>
<small>Aguarde</small>
</p>
</body>
</html>`;

  return new Response(redirectHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'attachment; filename="redirect.html"',
    },
  });
}
