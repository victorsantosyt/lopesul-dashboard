import * as mock from './mock.js';
import * as pagarme from './pagarme.js';

export function getProvider() {
  const raw = process.env.PSP_PROVIDER || 'mock';
  const p = raw.trim().toLowerCase();

  // Normaliza sinônimos
  const isPagarme = ['pagarme', 'pagar.me', 'stone'].includes(p);

  if (isPagarme) {
    if (!process.env.PAGARME_API_KEY) {
      console.warn(
        '[psp] PSP_PROVIDER=pagarme mas PAGARME_API_KEY não foi definido. ' +
        'Caindo em mock para evitar falha em produção.'
      );
      return mock;
    }
    return pagarme;
  }

  if (p !== 'mock') {
    console.warn(`[psp] PSP_PROVIDER="${raw}" desconhecido, usando mock`);
  }
  return mock;
}
