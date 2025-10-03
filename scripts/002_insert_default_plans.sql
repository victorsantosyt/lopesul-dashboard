-- Insert default plans
INSERT INTO plans (name, description, duration_hours, price_cents, active) VALUES
  ('1 Hora', 'Acesso à internet por 1 hora', 1, 500, true),
  ('3 Horas', 'Acesso à internet por 3 horas', 3, 1200, true),
  ('6 Horas', 'Acesso à internet por 6 horas', 6, 2000, true),
  ('1 Dia', 'Acesso à internet por 24 horas', 24, 3500, true),
  ('7 Dias', 'Acesso à internet por 7 dias', 168, 15000, true)
ON CONFLICT DO NOTHING;
