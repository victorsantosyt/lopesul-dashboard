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
  const id = normalizeString(deviceId);
  if (id) {
    const byId = await prisma.dispositivo.findUnique({ where: { id } }).catch(() => null);
    if (byId) return byId;
  }

  const mik = normalizeString(mikId);
  if (mik) {
    const byMik = await prisma.dispositivo.findUnique({ where: { mikId: mik } }).catch(() => null);
    if (byMik) return byMik;
  }

  const deviceIp = normalizeString(ip);
  if (deviceIp) {
    const byIp = await prisma.dispositivo.findFirst({ where: { ip: deviceIp } }).catch(() => null);
    if (byIp) return byIp;
  }

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

