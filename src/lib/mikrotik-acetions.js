import { addToAddressList } from '@/lib/mikrotik';

export async function liberarClienteNoMikrotik({ ip, mac }) {
  const lista = process.env.MIKROTIK_PAID_LIST || 'paid_clients';
  if (ip) {
    await addToAddressList(ip, lista);
  }
  // Se você também usa MAC (L2), crie uma address-list separada ou amarre por MAC-cookie.
}
