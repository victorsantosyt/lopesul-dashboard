import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔍 Verificando todas as sessões de cortesia ativas...\n');
    
    const sessoes = await prisma.sessaoAtiva.findMany({
      where: {
        ativo: true,
        expiraEm: { gte: new Date() },
        plano: { contains: 'Cortesia', mode: 'insensitive' },
      },
      include: {
        pedido: {
          select: {
            code: true,
            ip: true,
            deviceMac: true,
            customerName: true,
            createdAt: true,
          },
        },
      },
      orderBy: { inicioEm: 'desc' },
    });
    
    console.log(`📊 Total de sessões de cortesia ativas: ${sessoes.length}\n`);
    
    sessoes.forEach((s, i) => {
      console.log(`${i + 1}. IP: ${s.ipCliente}`);
      console.log(`   MAC: ${s.macCliente || 'N/A'}`);
      console.log(`   Plano: ${s.plano}`);
      console.log(`   Pedido: ${s.pedido?.code || 'N/A'}`);
      console.log(`   Cliente: ${s.pedido?.customerName || 'N/A'}`);
      console.log(`   Início: ${s.inicioEm.toISOString()}`);
      console.log(`   Expira: ${s.expiraEm.toISOString()}`);
      console.log('');
    });
    
    // Verificar especificamente o cliente liberado
    const clienteLiberado = sessoes.find(s => 
      s.ipCliente === '192.168.88.80' || 
      s.macCliente === '8A:22:3C:F4:F9:70'
    );
    
    if (clienteLiberado) {
      console.log('✅ Cliente liberado (192.168.88.80 / 8A:22:3C:F4:F9:70) encontrado!');
    } else {
      console.log('❌ Cliente liberado (192.168.88.80 / 8A:22:3C:F4:F9:70) NÃO encontrado nas sessões ativas.');
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
