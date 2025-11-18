import prisma from '@/lib/prisma';

type DeviceLookup = {
  deviceId?: string | null;
  mikId?: string | null;
  ip?: string | null;
};

type RouterPayload = {
  host: string;
  user: string;
  pass: string;
  port: number;
  secure: boolean;
};

type DeviceRecord = Awaited<ReturnType<typeof prisma.dispositivo.findUnique>>;

function normalizeString(value: string | null | undefined) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  if (/^\$\(.+\)$/.test(trimmed)) return null;
  return trimmed;
}

function buildError(code: string, message: string, extra: Record<string, unknown> = {}) {
  const err = new Error(message) as Error & { code?: string };
  err.code = code;
  Object.assign(err, extra);
  return err;
}

export async function findDeviceRecord({ deviceId, mikId, ip }: DeviceLookup = {}) {
  console.log('[device-router] Buscando dispositivo:', { deviceId, mikId, ip });
  
  const id = normalizeString(deviceId);
  if (id) {
    console.log('[device-router] Buscando por id:', id);
    const byId = await prisma.dispositivo.findUnique({ where: { id } }).catch((err) => {
      console.error('[device-router] Erro ao buscar por id:', err);
      return null;
    });
    if (byId) {
      console.log('[device-router] Dispositivo encontrado por id:', byId.id);
      return byId;
    }
    console.log('[device-router] Dispositivo não encontrado por id');
  }

  const mik = normalizeString(mikId);
  if (mik) {
    console.log('[device-router] Buscando por mikId:', mik);
    const byMik = await prisma.dispositivo.findUnique({ where: { mikId: mik } }).catch((err) => {
      console.error('[device-router] Erro ao buscar por mikId:', err);
      return null;
    });
    if (byMik) {
      console.log('[device-router] Dispositivo encontrado por mikId:', byMik.id);
      return byMik;
    }
    console.log('[device-router] Dispositivo não encontrado por mikId');
  }

  const deviceIp = normalizeString(ip);
  if (deviceIp) {
    console.log('[device-router] Buscando por ip:', deviceIp);
    const byIp = await prisma.dispositivo.findFirst({ where: { ip: deviceIp } }).catch((err) => {
      console.error('[device-router] Erro ao buscar por ip:', err);
      return null;
    });
    if (byIp) {
      console.log('[device-router] Dispositivo encontrado por ip:', byIp.id);
      return byIp;
    }
    console.log('[device-router] Dispositivo não encontrado por ip');
  }

  console.log('[device-router] Nenhum dispositivo encontrado');
  return null;
}

export function buildRouterPayloadFromDevice(device: DeviceRecord | null): RouterPayload {
  if (
    !device ||
    !device.mikrotikHost ||
    !device.mikrotikUser ||
    !device.mikrotikPass
  ) {
    throw buildError(
      'device_missing_credentials',
      'Dispositivo sem credenciais completas de Mikrotik.',
      { deviceId: device?.id ?? null, mikId: device?.mikId ?? null },
    );
  }

  return {
    host: device.mikrotikHost,
    user: device.mikrotikUser,
    pass: device.mikrotikPass,
    port: device.mikrotikPort || 8728,
    secure: Boolean(device.mikrotikUseSsl),
  };
}

export async function requireDeviceRouter(input: DeviceLookup = {}) {
  const device = await findDeviceRecord(input);
  if (!device) {
    throw buildError('device_not_found', 'Dispositivo não encontrado.', {
      lookup: input,
    });
  }

  const router = buildRouterPayloadFromDevice(device);

  return { device, router };
}

export async function ensureDeviceRouter(input: DeviceLookup = {}) {
  try {
    return await requireDeviceRouter(input);
  } catch (err: any) {
    if (err?.code === 'device_not_found') return { device: null, router: null };
    throw err;
  }
}

