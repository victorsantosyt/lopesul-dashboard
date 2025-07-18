-- CreateTable
CREATE TABLE "Frota" (
    "id" TEXT NOT NULL,
    "vendas" DOUBLE PRECISION NOT NULL,
    "acessos" INTEGER NOT NULL,
    "mikrotik" TEXT NOT NULL,

    CONSTRAINT "Frota_pkey" PRIMARY KEY ("id")
);
