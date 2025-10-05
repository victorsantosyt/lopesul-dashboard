CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE v_pedido_id uuid;
BEGIN
  -- pega o pedido por code (se existir)
  SELECT "id" INTO v_pedido_id FROM "Pedido" WHERE "code" = 'PED_TESTE';

  -- cria se não existir, senão só atualiza o updatedAt
  IF v_pedido_id IS NULL THEN
    INSERT INTO "Pedido" ("id","code","amount","method","status","createdAt","updatedAt")
    VALUES (gen_random_uuid(),'PED_TESTE',1000,'PIX','PENDING',now(),now())
    RETURNING "id" INTO v_pedido_id;
  ELSE
    UPDATE "Pedido" SET "updatedAt" = now() WHERE "id" = v_pedido_id;
  END IF;

  -- cria a charge se não existir; se existir só atualiza o updatedAt
  IF NOT EXISTS (SELECT 1 FROM "Charge" WHERE "providerId" = 'TXID_TESTE') THEN
    INSERT INTO "Charge" ("id","pedidoId","providerId","status","method","createdAt","updatedAt")
    VALUES (gen_random_uuid(),v_pedido_id,'TXID_TESTE','CREATED','PIX',now(),now());
  ELSE
    UPDATE "Charge" SET "updatedAt" = now() WHERE "providerId" = 'TXID_TESTE';
  END IF;
END$$;
