// src/lib/plan-duration.js
// Helper para calcular duração de sessão baseado na descrição do plano

const PLANOS_MIN = {
  'Acesso 12h': 12 * 60,
  'Acesso 24h': 24 * 60,
  'Acesso 48h': 48 * 60,
  '12h': 12 * 60,
  '24h': 24 * 60,
  '48h': 48 * 60,
  '12 horas': 12 * 60,
  '24 horas': 24 * 60,
  '48 horas': 48 * 60,
};

const DEFAULT_MIN = 120; // 2 horas padrão

/**
 * Calcula minutos de duração baseado na descrição do plano/pedido
 * @param {string|object} descricao - Descrição do plano ou objeto com campo 'description' ou 'plano'
 * @returns {number} Minutos de duração
 */
export function calcularMinutosPlano(descricao) {
  if (!descricao) return DEFAULT_MIN;
  
  // Se for objeto, tentar extrair description ou plano
  let desc = '';
  if (typeof descricao === 'object') {
    desc = (descricao.description || descricao.plano || descricao.plan || '').toLowerCase();
  } else {
    desc = String(descricao).toLowerCase();
  }
  
  // Verificar se está no mapa de planos
  for (const [key, minutos] of Object.entries(PLANOS_MIN)) {
    if (desc.includes(key.toLowerCase())) {
      return minutos;
    }
  }
  
  // Tentar extrair padrões como "12h", "24h", "48h"
  const match = desc.match(/(\d+)\s*(?:h|horas?)/i);
  if (match) {
    const horas = parseInt(match[1], 10);
    if (horas > 0 && horas <= 168) { // Máximo 7 dias
      return horas * 60;
    }
  }
  
  return DEFAULT_MIN;
}

