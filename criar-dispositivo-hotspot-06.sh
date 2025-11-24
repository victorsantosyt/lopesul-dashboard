#!/bin/bash
# Script para criar o dispositivo LOPESUL-HOTSPOT-06 no banco
# Execute no servidor: cd /opt/lopesul-dashboard && node criar-dispositivo-hotspot-06.js

cat > criar-dispositivo-hotspot-06.js << 'EOF'
#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Criando dispositivo LOPESUL-HOTSPOT-06...\n");

  try {
    // Primeiro, verificar se já existe
    const existente = await prisma.dispositivo.findUnique({
      where: { mikId: "LOPESUL-HOTSPOT-06" },
    });

    if (existente) {
      console.log("✅ Dispositivo já existe:");
      console.log(JSON.stringify(existente, null, 2));
      return;
    }

    // Buscar uma frota para associar (ou criar uma nova)
    const frota = await prisma.frota.findFirst();
    
    if (!frota) {
      console.log("❌ Nenhuma frota encontrada. Criando uma nova...");
      const novaFrota = await prisma.frota.create({
        data: {
          nome: "Frota Padrão",
          status: "ATIVO",
        },
      });
      console.log("✅ Frota criada:", novaFrota.id);
    }

    const frotaId = frota?.id || (await prisma.frota.findFirst()).id;

    // Criar o dispositivo
    // IMPORTANTE: Você precisa fornecer os valores corretos para:
    // - ip: IP do dispositivo (ex: 10.200.200.7)
    // - mikrotikHost: IP do Mikrotik (ex: 10.200.200.7)
    // - mikrotikUser: usuário do Mikrotik (ex: relay ou admin)
    // - mikrotikPass: senha do Mikrotik
    
    console.log("⚠️  ATENÇÃO: Você precisa fornecer os dados corretos!");
    console.log("   - IP do dispositivo");
    console.log("   - IP do Mikrotik (host)");
    console.log("   - Usuário do Mikrotik");
    console.log("   - Senha do Mikrotik");
    console.log("\n📝 Exemplo de comando para criar:");
    console.log(`
    const dispositivo = await prisma.dispositivo.create({
      data: {
        mikId: "LOPESUL-HOTSPOT-06",
        ip: "10.200.200.7",  // ⚠️ AJUSTE ESTE IP
        mikrotikHost: "10.200.200.7",  // ⚠️ AJUSTE ESTE IP
        mikrotikUser: "relay",  // ⚠️ AJUSTE SE NECESSÁRIO
        mikrotikPass: "sua-senha-aqui",  // ⚠️ AJUSTE A SENHA
        frotaId: "${frotaId}",
      },
    });
    `);

  } catch (error) {
    console.error("❌ Erro:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
EOF

echo "✅ Script criado! Execute: node criar-dispositivo-hotspot-06.js"
echo ""
echo "⚠️  Você precisará editar o script e fornecer:"
echo "   - IP do dispositivo"
echo "   - IP do Mikrotik (host)"
echo "   - Usuário do Mikrotik"
echo "   - Senha do Mikrotik"

