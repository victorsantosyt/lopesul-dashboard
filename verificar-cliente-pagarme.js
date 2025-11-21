import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const PEDIDO_CODE = 'J0K9SDS80O';
const CHARGE_ID = 'ch_8zLVW06f9fVAXnBb';

async function main() {
  try {
    console.log('🔍 Verificando cliente do Pagar.me...\n');
    console.log(`📋 Pedido Code: ${PEDIDO_CODE}`);
    console.log(`💳 Charge ID: ${CHARGE_ID}\n`);

    // 1. Buscar pedido
    const pedido = await prisma.pedido.findUnique({
      where: { code: PEDIDO_CODE },
      include: {
        charges: {
          where: { providerId: CHARGE_ID },
          orderBy: { createdAt: 'desc' },
        },
        device: {
          select: {
            id: true,
            mikId: true,
            ip: true,
            mikrotikHost: true,
          },
        },
        SessaoAtiva: {
          where: { ativo: true },
          include: {
            roteador: {
              select: {
                nome: true,
                ipLan: true,
              },
            },
          },
        },
      },
    });

    if (!pedido) {
      console.log('❌ Pedido não encontrado no banco de dados!');
      return;
    }

    console.log('✅ Pedido encontrado:');
    console.log(`   ID: ${pedido.id}`);
    console.log(`   Status: ${pedido.status}`);
    console.log(`   Valor: R$ ${(pedido.amount / 100).toFixed(2)}`);
    console.log(`   Método: ${pedido.method}`);
    console.log(`   Descrição: ${pedido.description || 'N/A'}`);
    console.log(`   Criado em: ${pedido.createdAt.toISOString()}`);
    console.log(`   IP: ${pedido.ip || 'N/A'}`);
    console.log(`   MAC: ${pedido.deviceMac || 'N/A'}`);
    console.log(`   Cliente: ${pedido.customerName || 'N/A'}`);
    console.log(`   CPF/CNPJ: ${pedido.customerDoc || 'N/A'}`);
    console.log('');

    // 2. Verificar charges
    if (pedido.charges.length > 0) {
      console.log('💳 Charges encontradas:');
      pedido.charges.forEach((c, i) => {
        console.log(`   ${i + 1}. ID: ${c.id}`);
        console.log(`      Provider ID: ${c.providerId || 'N/A'}`);
        console.log(`      Status: ${c.status}`);
        console.log(`      Criado em: ${c.createdAt.toISOString()}`);
        if (c.providerId === CHARGE_ID) {
          console.log(`      ✅ Esta é a charge do Pagar.me!`);
        }
      });
      console.log('');
    } else {
      console.log('⚠️ Nenhuma charge encontrada para este pedido');
      console.log('');
    }

    // 3. Verificar dispositivo
    if (pedido.device) {
      console.log('📱 Dispositivo associado:');
      console.log(`   ID: ${pedido.device.id}`);
      console.log(`   MikId: ${pedido.device.mikId || 'N/A'}`);
      console.log(`   IP: ${pedido.device.ip || 'N/A'}`);
      console.log(`   Host: ${pedido.device.mikrotikHost || 'N/A'}`);
      console.log('');
    } else {
      console.log('⚠️ Nenhum dispositivo associado ao pedido');
      console.log('');
    }

    // 4. Verificar sessões ativas
    if (pedido.SessaoAtiva.length > 0) {
      console.log('✅ Sessões ativas encontradas:');
      pedido.SessaoAtiva.forEach((s, i) => {
        const now = new Date();
        const expiraEm = new Date(s.expiraEm);
        const estaExpirada = expiraEm < now;
        
        console.log(`   ${i + 1}. Sessão ID: ${s.id}`);
        console.log(`      IP Cliente: ${s.ipCliente}`);
        console.log(`      MAC Cliente: ${s.macCliente || 'N/A'}`);
        console.log(`      Plano: ${s.plano}`);
        console.log(`      Início: ${s.inicioEm.toISOString()}`);
        console.log(`      Expira: ${s.expiraEm.toISOString()}`);
        console.log(`      Status: ${s.ativo ? (estaExpirada ? '⚠️ Expirada' : '✅ Ativa') : '❌ Inativa'}`);
        if (s.roteador) {
          console.log(`      Roteador: ${s.roteador.nome} (${s.roteador.ipLan})`);
        }
        console.log('');
      });
    } else {
      console.log('❌ Nenhuma sessão ativa encontrada para este pedido!');
      console.log('');
    }

    // 5. Verificar se há sessão ativa por IP/MAC
    if (pedido.ip || pedido.deviceMac) {
      console.log('🔍 Verificando sessões ativas por IP/MAC...');
      const sessaoWhere = {
        ativo: true,
        expiraEm: { gte: new Date() },
        OR: [],
      };
      
      if (pedido.ip) {
        sessaoWhere.OR.push({ ipCliente: pedido.ip });
      }
      if (pedido.deviceMac) {
        sessaoWhere.OR.push({ macCliente: pedido.deviceMac });
      }

      if (sessaoWhere.OR.length > 0) {
        const sessoesPorIpMac = await prisma.sessaoAtiva.findMany({
          where: sessaoWhere,
          include: {
            pedido: {
              select: {
                code: true,
                status: true,
              },
            },
            roteador: {
              select: {
                nome: true,
              },
            },
          },
        });

        if (sessoesPorIpMac.length > 0) {
          console.log(`   ✅ Encontradas ${sessoesPorIpMac.length} sessão(ões) ativa(s) por IP/MAC:`);
          sessoesPorIpMac.forEach((s, i) => {
            console.log(`      ${i + 1}. IP: ${s.ipCliente}, MAC: ${s.macCliente || 'N/A'}`);
            console.log(`         Pedido: ${s.pedido?.code || 'N/A'} (${s.pedido?.status || 'N/A'})`);
            console.log(`         Roteador: ${s.roteador?.nome || 'N/A'}`);
          });
        } else {
          console.log('   ❌ Nenhuma sessão ativa encontrada por IP/MAC');
        }
      }
      console.log('');
    }

    // 6. Resumo final
    console.log('📊 RESUMO:');
    const temSessaoAtiva = pedido.SessaoAtiva.some(s => {
      const now = new Date();
      return s.ativo && new Date(s.expiraEm) >= now;
    });
    
    if (temSessaoAtiva) {
      console.log('   ✅ Cliente está ATIVO');
      const sessao = pedido.SessaoAtiva.find(s => {
        const now = new Date();
        return s.ativo && new Date(s.expiraEm) >= now;
      });
      if (sessao) {
        console.log(`   📍 IP Ativo: ${sessao.ipCliente}`);
        console.log(`   📍 MAC Ativo: ${sessao.macCliente || 'N/A'}`);
        const minutosRestantes = Math.floor((new Date(sessao.expiraEm) - new Date()) / 60000);
        console.log(`   ⏰ Tempo restante: ~${Math.floor(minutosRestantes / 60)}h ${minutosRestantes % 60}min`);
      }
    } else {
      console.log('   ❌ Cliente NÃO está ativo');
      if (pedido.SessaoAtiva.length > 0) {
        console.log('   ⚠️ Há sessão(ões) mas estão expiradas ou inativas');
      } else {
        console.log('   ⚠️ Nenhuma sessão foi criada para este pedido');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
