// src/lib/wireguard.ts

const DEFAULT_BASE = 'http://127.0.0.1:4001';

function getEnv(name: string): string {
  if (typeof process === 'undefined' || !process.env) return '';
  return process.env[name] || '';
}

function getManagerUrl(): string {
  const base = getEnv('WG_MANAGER_URL') || DEFAULT_BASE;
  return base.replace(/\/+$/, '');
}

function getManagerToken(): string {
  return getEnv('WG_MANAGER_TOKEN') || '';
}

export interface WireguardPeerPayload {
  publicKey: string;
  allowedIp?: string;
  remove?: boolean;
}

export interface WireguardSyncResult {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  body?: any;
  reason?: string;
}

function logDebug(message: string, extra?: Record<string, any>) {
  try {
    // Log simples para depuração em produção (pode ser filtrado por prefixo)
    console.log('[wireguard]', message, extra || '');
  } catch {
    // ignora erros de log
  }
}

/**
 * Sincroniza um peer no WG Manager local (127.0.0.1:4001 por padrão).
 *
 * Requer variáveis de ambiente:
 *  - WG_MANAGER_URL   (opcional, default http://127.0.0.1:4001)
 *  - WG_MANAGER_TOKEN (obrigatório)
 */
export async function syncWireguardPeer(
  payload: WireguardPeerPayload
): Promise<WireguardSyncResult> {
  try {
    const base = getManagerUrl();
    const token = getManagerToken();

    if (!token) {
      const reason = 'wg_manager_token_missing';
      logDebug('syncWireguardPeer skipped: token ausente', { reason });
      return { ok: false, skipped: true, reason };
    }

    if (!base) {
      const reason = 'wg_manager_url_missing';
      logDebug('syncWireguardPeer skipped: URL do manager ausente', { reason });
      return { ok: false, skipped: true, reason };
    }

    if (!payload?.publicKey) {
      const reason = 'public_key_missing';
      logDebug('syncWireguardPeer skipped: publicKey ausente', { reason });
      return { ok: false, skipped: true, reason };
    }

    const url = `${base}/peers`;
    logDebug('syncWireguardPeer request', {
      url,
      hasAllowedIp: Boolean(payload.allowedIp),
      remove: Boolean(payload.remove),
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));
    const ok = res.ok && body?.ok !== false;

    if (!ok) {
      logDebug('syncWireguardPeer response NOT ok', {
        status: res.status,
        body,
      });
    } else {
      logDebug('syncWireguardPeer response ok', {
        status: res.status,
      });
    }

    return {
      ok,
      status: res.status,
      body,
      reason: ok ? undefined : body?.reason || `http_${res.status}`,
    };
  } catch (e: any) {
    const message = String(e?.message || e || 'unknown_error');
    console.error('[wireguard] syncWireguardPeer error:', message);
    return { ok: false, reason: message };
  }
}
