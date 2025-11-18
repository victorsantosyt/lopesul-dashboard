# Fluxos Backend – Rotas e Serviços Principais

Este documento mapeia os principais fluxos do backend (Next.js API Routes), com foco em roteadores Mikrotik, WireGuard e pagamento/liberação de acesso.

## Visão geral da API

A API está estruturada em `src/app/api/`, usando rotas padrão do Next.js (App Router). Alguns pontos importantes:

- Persistência via Prisma (`prisma/schema.prisma`).
- Integrações externas encapsuladas em `src/lib/`:
  - `src/lib/wireguard.ts` – integração com WG Manager.
  - `src/mikrotik.ts`, `src/relay.ts` – integração com Mikrotik/relay.
  - `src/pagarme.js` – integração com Pagar.me (pagamentos Pix/cartão).

Abaixo, os fluxos mais relevantes para a arquitetura multi-Mikrotik.

## Roteadores (Mikrotiks)

### Listar roteadores

- **Rota**: `GET /api/roteadores`
- **Arquivo**: `src/app/api/roteadores/route.js`
- **Função**: listar todos os roteadores cadastrados.
- **Comportamento**:
  - Retorna os campos principais do modelo `Roteador` (id, nome, ipLan, portas API/SSH, dados WireGuard, status, timestamps).
  - Ordenação típica: mais recentes primeiro.
  - Em caso de erro inesperado: responde 500 com JSON de erro genérico.

### Criar roteador

- **Rota**: `POST /api/roteadores`
- **Arquivo**: `src/app/api/roteadores/route.js`
- **Entrada mínima**:
  - `nome` – nome amigável do roteador.
  - `ipLan` – IP na LAN/túnel pelo qual o Mikrotik é acessível.
  - `usuario` – usuário para acesso/integração.
  - `senha` – senha em texto plano (apenas na requisição; é persistida em hash).
- **Campos opcionais**:
  - `portaApi` (default 8728).
  - `portaSsh` (default 22).
  - `wgPublicKey` e `wgIp` – dados para integração WireGuard.
- **Regras**:
  - Se faltar `nome`, `ipLan`, `usuario` ou `senha`, retorna 400.
  - A senha é transformada em `senhaHash` (bcrypt) antes de salvar.
  - Se `wgPublicKey` e `wgIp` forem informados, chama `syncWireguardPeer()` de `src/lib/wireguard.ts` para sincronizar o peer no WG Manager.
    - Se o sync for bem-sucedido, o `statusWireguard` é ajustado para `ONLINE`.
    - Se falhar, o `statusWireguard` tende a ser marcado como `ERRO` (sem interromper totalmente a criação do roteador).

### Detalhar roteador

- **Rota**: `GET /api/roteadores/:id`
- **Arquivo**: `src/app/api/roteadores/[id]/route.js`
- **Comportamento**:
  - Valida o `id` (se ausente/invalid, responde 400).
  - Busca o roteador pelo `id` com os mesmos campos utilizados na listagem.
  - Se não encontrar, responde 404.

### Atualizar roteador

- **Rota**: `PUT /api/roteadores/:id`
- **Arquivo**: `src/app/api/roteadores/[id]/route.js`
- **Campos atualizáveis**:
  - `nome`, `ipLan`, `usuario`, `portaApi`, `portaSsh`, `wgPublicKey`, `wgIp`, `statusMikrotik`, `statusWireguard`.
  - `senha` (se presente e não vazia) é novamente hasheada e salva em `senhaHash`.
- **Regras**:
  - Valida `id` (400 em caso de erro de formato).
  - Atualiza somente os campos informados.
  - Em caso de erro interno, retorna 500 com mensagem genérica.

### Remover roteador

- **Rota**: `DELETE /api/roteadores/:id`
- **Arquivo**: `src/app/api/roteadores/[id]/route.js`
- **Comportamento**:
  - Valida `id`.
  - Remove o roteador correspondente.
  - Responde com `{ ok: true, id }` em caso de sucesso.
  - Em erro interno, retorna 500.

### Debug de status do roteador

- **Rota de debug (frontend)**: `GET /roteadores/debug`
- **Arquivo**: `src/app/roteadores/debug/page.jsx`
- **Funções principais da página**:
  - Carregar todos os roteadores via `GET /api/roteadores`.
  - Para cada roteador (ou para todos em sequência), chamar `GET /api/roteadores/:id/status`.
  - Exibir o resultado de cada chamada em formato JSON legível, incluindo:
    - `httpStatus` da chamada.
    - Corpo da resposta com campos como: `mikrotikOnline`, `pingOk`, `identity`, etc. (conforme implementação do endpoint de status).
- **Uso**:
  - Funciona como um "painel de diagnóstico" em tempo real da comunicação com cada Mikrotik.

> Observação: o endpoint `GET /api/roteadores/:id/status` está implementado em `src/app/api/roteadores/[id]/status/route.*` (ou arquivo equivalente) e costuma combinar:
>
> - Teste de conexão TCP com a API Mikrotik.
> - Ping ICMP.
> - Verificação de identidade/hostname via relay.

## Pagamentos / Pix / Liberação de acesso

> **Nota**: esta seção é um resumo de alto nível; para detalhes completos de configuração e exemplos de payload, ver:
> - `CONFIGURACAO_COMPLETA.md`
> - `SISTEMA_100_FUNCIONAL.md`
> - `SISTEMA_PRONTO.md`

### Criação de pedido

- Cliente acessa a página de planos/pagamento (via redirecionamento do hotspot ou acesso direto).
- O backend cria um **Pedido** e/ou **Charge** no banco (modelos `Pedido` e `Charge` em `prisma/schema.prisma`).
- É gerado um QR Code Pix ou link de pagamento (via integração Pagar.me).

### Webhook de pagamento

- O provedor de pagamento (Pagar.me) envia notificações para um endpoint do painel (rota em `src/app/api/webhooks/...`).
- O backend atualiza o status do `Pedido`/`Charge` de acordo com o evento recebido (`PAGO`, `CANCELADO`, etc.).

### Liberação no Mikrotik (relay)

- Quando o pagamento é confirmado:
  - O backend chama o **relay** (ver `src/relay.ts` e docs de configuração) passando os dados necessários (MAC, IP, plano, tempo de acesso, etc.).
  - O relay usa a API Mikrotik para atualizar listas de autorização/queues.
- O cliente passa a ter acesso à internet pela duração do plano.

## Saúde do sistema

Há endpoints e rotas auxiliares para verificar o estado do sistema:

- **Saúde do banco**: endpoint do painel para verificar conexão com o PostgreSQL (ex.: `/api/db-health`).
- **Saúde do relay**: checagem HTTP do serviço de relay (ex.: `${RELAY_URL}/health`).

Esses endpoints são usados em scripts de deploy/monitoramento (ver `DEPLOY.md`) para garantir que o painel está funcionando corretamente após atualizações.

## Onde aprofundar

- **Arquitetura Mikrotik/WireGuard**: `docs/arquitetura-mikrotik.md`.
- **Modelagem de dados**: `docs/prisma-models.md` + `prisma/schema.prisma`.
- **Histórico de mudanças técnicas**: `docs/historico-tecnico.md`.
