-- CreateEnum
CREATE TYPE "TipoDispositivo" AS ENUM ('mikrotik', 'starlink');

-- CreateTable
CREATE TABLE "Dispositivo" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoDispositivo" NOT NULL,
    "ip" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'desconhecido',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "onibusId" TEXT NOT NULL,

    CONSTRAINT "Dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dispositivo_ip_key" ON "Dispositivo"("ip");

-- AddForeignKey
ALTER TABLE "Dispositivo" ADD CONSTRAINT "Dispositivo_onibusId_fkey" FOREIGN KEY ("onibusId") REFERENCES "Frota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
