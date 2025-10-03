-- Script para limpeza automática de dados antigos
-- Execute este script periodicamente (recomendado: 1x por semana)

-- Limpar pagamentos antigos (mais de 90 dias)
DELETE FROM payments
WHERE created_at < NOW() - INTERVAL '90 days'
AND status IN ('expired', 'cancelled');

-- Limpar sessões antigas do hotspot (mais de 30 dias)
DELETE FROM hotspot_sessions
WHERE ended_at IS NOT NULL
AND ended_at < NOW() - INTERVAL '30 days';

-- Limpar logs antigos (mais de 30 dias)
DELETE FROM system_logs
WHERE created_at < NOW() - INTERVAL '30 days';

-- Vacuum para recuperar espaço
VACUUM ANALYZE payments;
VACUUM ANALYZE hotspot_sessions;
VACUUM ANALYZE system_logs;

-- Log da limpeza
INSERT INTO system_logs (level, message, context)
VALUES (
  'info',
  'Limpeza automática de dados antigos executada',
  jsonb_build_object(
    'executed_at', NOW(),
    'retention_days', 90
  )
);
