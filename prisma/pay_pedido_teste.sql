UPDATE "Pedido"
SET "status" = 'PAID', "updatedAt" = now()
WHERE "code" = 'PED_TESTE';

UPDATE "Charge"
SET "status" = 'PAID', "updatedAt" = now()
WHERE "providerId" = 'TXID_TESTE';
