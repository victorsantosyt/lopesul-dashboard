-- Manual migration: add roteadorId to sessoes_ativas and FK to Roteador

ALTER TABLE "sessoes_ativas"
  ADD COLUMN IF NOT EXISTS "roteadorId" TEXT NULL;

ALTER TABLE "sessoes_ativas"
  ADD CONSTRAINT IF NOT EXISTS "sessoes_ativas_roteadorId_fkey"
    FOREIGN KEY ("roteadorId") REFERENCES "Roteador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "sessoes_ativas_roteadorId_idx"
  ON "sessoes_ativas"("roteadorId");
