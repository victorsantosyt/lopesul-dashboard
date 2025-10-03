# Configuração de Cron Jobs

Este documento explica como configurar os cron jobs para limpeza automática do sistema.

## O que o Cron faz?

O sistema de limpeza automática executa as seguintes tarefas:

1. **Revoga sessões expiradas** - Sessões que passaram do tempo de acesso são revogadas no Mikrotik
2. **Cancela pedidos antigos** - Pedidos pendentes há mais de 24 horas são cancelados
3. **Marca charges expiradas** - Charges PIX que expiraram são marcadas como expiradas
4. **Limpa dados antigos** - Remove pedidos cancelados há mais de 90 dias

## Configuração no Vercel

1. Acesse o projeto no Vercel Dashboard
2. Vá em **Settings** > **Cron Jobs**
3. Clique em **Add Cron Job**
4. Configure:
   - **Path**: `/api/cron/limpeza`
   - **Schedule**: `0 * * * *` (a cada hora)
   - **Custom Headers**: 
     - Key: `Authorization`
     - Value: `Bearer [seu-cron-secret]`

5. Adicione a variável de ambiente:
   - Key: `CRON_SECRET`
   - Value: `[seu-token-secreto-aqui]`

## Configuração em Servidor Próprio

Se estiver hospedando em servidor próprio, use crontab:

\`\`\`bash
# Editar crontab
crontab -e

# Adicionar linha (executar a cada hora)
0 * * * * curl -H "Authorization: Bearer SEU_TOKEN_SECRETO" https://seu-dominio.com/api/cron/limpeza
\`\`\`

## Configuração Manual

Você também pode executar a limpeza manualmente através da interface admin:

1. Acesse `/admin/pagamentos`
2. Clique no botão "Executar Limpeza"
3. O sistema executará todas as tarefas de limpeza imediatamente

## Testando

Para testar se o cron está funcionando:

\`\`\`bash
curl -H "Authorization: Bearer SEU_TOKEN_SECRETO" \
  https://seu-dominio.com/api/cron/limpeza
\`\`\`

Resposta esperada:
\`\`\`json
{
  "success": true,
  "message": "Limpeza automática executada com sucesso",
  "resultados": {
    "sessoes_expiradas": 5,
    "sessoes_revogadas": 5,
    "pedidos_cancelados": 3,
    "charges_expiradas": 2,
    "pedidos_deletados": 10,
    "erros": []
  },
  "executado_em": "2025-02-03T10:00:00.000Z"
}
\`\`\`

## Monitoramento

Recomendamos configurar alertas para:
- Falhas na execução do cron
- Número alto de erros nos resultados
- Sessões que não foram revogadas no Mikrotik

## Segurança

- **NUNCA** exponha o `CRON_SECRET` publicamente
- Use um token forte e aleatório
- Considere usar diferentes tokens para produção e desenvolvimento
- Monitore os logs de acesso à rota `/api/cron/limpeza`
