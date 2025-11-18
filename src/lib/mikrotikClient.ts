// src/lib/mikrotikClient.ts
// Cliente baixo nível para executar comandos em um Mikrotik específico
// usando o Relay HTTP (/relay/exec). Não depende mais de MIKROTIK_HOST
// global; sempre recebe o roteador que deve ser usado.

import { relayFetch } from '@/lib/relay';
import type { Roteador } from '@prisma/client';

export interface MikrotikCommandResult {
  ok: boolean;
  command: string;
  status: number;
  data: unknown;
}

export interface MikrotikRouterContext {
  roteador: Pick<Roteador, 'id' | 'nome' | 'ipLan' | 'usuario'>;
  // Por enquanto ainda usamos usuário/senha globais ou usuario do roteador,
  // mas o HOST é sempre o do roteador.
  userFallback?: string | null;
}

function resolveCredentials(ctx: MikrotikRouterContext) {
  const host = ctx.roteador.ipLan?.trim();
  const userEnv = process.env.MIKROTIK_USER || '';
  const passEnv = process.env.MIKROTIK_PASS || '';

  const user = userEnv || ctx.roteador.usuario || '';
  const pass = passEnv; // ainda não temos senha por roteador; centralizada no Mikrotik

  if (!host || !user || !pass) {
    throw new Error(
      `mikrotik_credentials_missing for roteador ${ctx.roteador.id} (host/user/pass)`
    );
  }

  return { host, user, pass };
}

export async function execOnRouter(
  ctx: MikrotikRouterContext,
  command: string
): Promise<MikrotikCommandResult> {
  const { host, user, pass } = resolveCredentials(ctx);

  const r = await relayFetch('/relay/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, user, pass, command }),
  });

  const body = await r.json().catch(() => ({}));
  const ok = r.ok && (body?.ok !== false);

  return {
    ok,
    command,
    status: r.status,
    data: body,
  };
}

export interface LiberarClienteInput {
  ip?: string | null;
  mac?: string | null;
  username?: string | null;
  comment?: string | null;
}

export interface RevogarClienteInput {
  ip?: string | null;
  mac?: string | null;
  username?: string | null;
}

export interface MultiCommandResult {
  ok: boolean;
  results: MikrotikCommandResult[];
}

export async function liberarClienteOnRouter(
  ctx: MikrotikRouterContext,
  input: LiberarClienteInput
): Promise<MultiCommandResult> {
  const commands: string[] = [];
  const comment = (input.comment || '').slice(0, 64) || 'painel';

  if (input.ip) {
    commands.push(
      `/ip/firewall/address-list/add list=paid_clients address=${input.ip} comment="${comment}"`
    );
  }

  if (input.mac) {
    // Mantém comportamento anterior (access-list). Se futuramente migrar para ip-binding,
    // basta trocar o comando aqui.
    commands.push(
      `/interface/wireless/access-list/add mac-address=${input.mac} comment="${comment}"`
    );
  }

  if (input.username) {
    commands.push(
      `/ip/hotspot/user/add name=${input.username} password=${input.username}`
    );
  }

  if (commands.length === 0) {
    return { ok: true, results: [] };
  }

  const results: MikrotikCommandResult[] = [];
  let allOk = true;

  for (const cmd of commands) {
    try {
      const res = await execOnRouter(ctx, cmd);
      results.push(res);
      if (!res.ok) allOk = false;
    } catch (e: any) {
      results.push({
        ok: false,
        command: cmd,
        status: 500,
        data: { error: e?.message || String(e) },
      });
      allOk = false;
    }
  }

  return { ok: allOk, results };
}

export async function revogarClienteOnRouter(
  ctx: MikrotikRouterContext,
  input: RevogarClienteInput
): Promise<MultiCommandResult> {
  const commands: string[] = [];

  if (input.ip) {
    commands.push(
      `/ip/firewall/address-list/remove [find list=paid_clients address=${input.ip}]`
    );
  }

  if (input.mac) {
    commands.push(
      `/interface/wireless/access-list/remove [find mac-address=${input.mac}]`
    );
  }

  if (input.username) {
    commands.push(
      `/ip/hotspot/user/remove [find name=${input.username}]`
    );
  }

  if (commands.length === 0) {
    return { ok: true, results: [] };
  }

  const results: MikrotikCommandResult[] = [];
  let allOk = true;

  for (const cmd of commands) {
    try {
      const res = await execOnRouter(ctx, cmd);
      results.push(res);
      if (!res.ok) allOk = false;
    } catch (e: any) {
      results.push({
        ok: false,
        command: cmd,
        status: 500,
        data: { error: e?.message || String(e) },
      });
      allOk = false;
    }
  }

  return { ok: allOk, results };
}
