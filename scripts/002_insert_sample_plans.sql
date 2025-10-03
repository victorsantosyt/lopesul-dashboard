-- Inserir planos de exemplo com preços realistas
INSERT INTO public.plans (name, description, price_cents, duration_hours, speed_download, speed_upload) VALUES
('Plano 1 Hora', 'Acesso rápido por 1 hora', 300, 1, '10Mbps', '5Mbps'),
('Plano 3 Horas', 'Acesso por 3 horas', 800, 3, '15Mbps', '7Mbps'),
('Plano 6 Horas', 'Meio período de acesso', 1500, 6, '20Mbps', '10Mbps'),
('Plano 12 Horas', 'Acesso por 12 horas', 2500, 12, '25Mbps', '12Mbps'),
('Plano 1 Dia', 'Acesso por 24 horas completas', 4000, 24, '30Mbps', '15Mbps')
ON CONFLICT DO NOTHING;
