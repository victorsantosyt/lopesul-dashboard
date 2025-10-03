/**
 * Configuração para Cron Jobs
 *
 * Para configurar no Vercel:
 * 1. Vá em Project Settings > Cron Jobs
 * 2. Adicione um novo cron job:
 *    - Path: /api/cron/limpeza
 *    - Schedule: 0 * * * * (a cada hora)
 *    - Headers: Authorization: Bearer [CRON_SECRET]
 *
 * Para configurar em outro servidor:
 * Use crontab ou similar para fazer requisições HTTP:
 *
 * # A cada hora
 * 0 * * * * curl -H "Authorization: Bearer [CRON_SECRET]" https://seu-dominio.com/api/cron/limpeza
 *
 * Variáveis de ambiente necessárias:
 * - CRON_SECRET: Token secreto para autenticar requisições do cron
 */

export const CRON_CONFIG = {
  // Executar limpeza a cada hora
  limpeza: {
    schedule: "0 * * * *", // Formato cron: minuto hora dia mês dia-da-semana
    path: "/api/cron/limpeza",
    description: "Limpa sessões expiradas, cancela pedidos antigos e revoga acessos",
  },
}

export default CRON_CONFIG
