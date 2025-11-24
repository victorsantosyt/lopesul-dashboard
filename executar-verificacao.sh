#!/bin/bash
# Script para fazer pull e verificar dispositivos

echo "📥 Fazendo pull das alterações..."
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'cd /opt/lopesul-dashboard && git pull'

echo ""
echo "🔍 Verificando dispositivos..."
ssh -i ~/.ssh/id_ed25519 root@67.211.212.18 'cd /opt/lopesul-dashboard && cat > /tmp/verificar-dispositivos.js << '\''EOFSCRIPT'\''
import prisma from "./src/lib/prisma.js";

async function main() {
  console.log("🔍 Verificando dispositivos no banco de dados...\\n");

  try {
    const dispositivos = await prisma.dispositivo.findMany({
      select: {
        id: true,
        mikId: true,
        ip: true,
        mikrotikHost: true,
        mikrotikUser: true,
        frotaId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`📊 Total de dispositivos: ${dispositivos.length}\\n`);

    if (dispositivos.length === 0) {
      console.log("⚠️  Nenhum dispositivo encontrado no banco!");
      return;
    }

    console.log("📋 Lista de dispositivos:\\n");
    dispositivos.forEach((d, i) => {
      console.log(`${i + 1}. ID (UUID): ${d.id}`);
      console.log(`   mikId: ${d.mikId || "(não definido)"}`);
      console.log(`   IP: ${d.ip}`);
      console.log(`   Mikrotik Host: ${d.mikrotikHost || "(não definido)"}`);
      console.log(`   Mikrotik User: ${d.mikrotikUser || "(não definido)"}`);
      console.log(`   Frota ID: ${d.frotaId}`);
      console.log("");
    });

    console.log("\\n🔎 Buscando especificamente por \\"LOPESUL-HOTSPOT-06\\":\\n");
    const porMikId = await prisma.dispositivo.findUnique({
      where: { mikId: "LOPESUL-HOTSPOT-06" },
    });
    
    if (porMikId) {
      console.log("✅ Encontrado por mikId:");
      console.log(JSON.stringify(porMikId, null, 2));
    } else {
      console.log("❌ Não encontrado por mikId exato");
    }

    const todos = await prisma.dispositivo.findMany({
      where: {
        OR: [
          { mikId: { contains: "LOPESUL", mode: "insensitive" } },
          { mikId: { contains: "HOTSPOT", mode: "insensitive" } },
        ],
      },
    });

    if (todos.length > 0) {
      console.log("\\n🔍 Dispositivos com \\"LOPESUL\\" ou \\"HOTSPOT\\" no mikId:");
      todos.forEach(d => {
        console.log(`  - mikId: ${d.mikId}, ID: ${d.id}`);
      });
    }
  } catch (error) {
    console.error("❌ Erro:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
EOFSCRIPT
node /tmp/verificar-dispositivos.js'

