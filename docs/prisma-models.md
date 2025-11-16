# Modelos Prisma – Visão de Domínio

Este documento resume os modelos mais importantes definidos em `prisma/schema.prisma` e como eles se relacionam com a arquitetura do sistema.

Para o schema completo, consulte diretamente `prisma/schema.prisma`.

## Roteador

Representa cada Mikrotik conhecido pelo sistema.

- **Arquivo**: `prisma/schema.prisma`
- **Tabela**: `Roteador` (nome lógico; conferir `@@map` para nome físico se aplicável).
- **Campos principais (resumo)**:
  - `id` – identificador único (cuid).
  - `nome` – nome amigável do roteador.
  - `ipLan` – IP usado pelo painel/relay para alcançar o Mikrotik (LAN/túnel).
  - `usuario` – usuário de acesso.
  - `senhaHash` – hash da senha (bcrypt); a senha em texto plano nunca é armazenada.
  - `portaApi` – porta da API Mikrotik (padrão 8728).
  - `portaSsh` – porta SSH (padrão 22).
  - `wgPublicKey?` – chave pública WireGuard (se houver túnel configurado).
  - `wgIp?` – IP interno do roteador no túnel WireGuard.
  - `statusMikrotik` – enum `RoteadorStatus` (ex.: `ONLINE`, `OFFLINE`, `DESCONHECIDO`).
  - `statusWireguard` – enum `RoteadorStatus` (estado da integração WireGuard).
  - `createdAt` / `updatedAt` – timestamps.
- **Relações**:
  - `frota` – relação 1–1 opcional com `Frota`.

Este modelo é consumido diretamente pelos endpoints `/api/roteadores` e pela página `/roteadores/debug`.

## Frota

Representa uma frota/cliente/grupo que pode estar associado a um roteador.

- **Campos principais**:
  - `id`, `nome`, dados de contato/identificação.
  - `status` – enum `FrotaStatus` (por exemplo, `ATIVA`, `INATIVA`).
  - `roteadorId?` – referência opcional para a tabela `Roteador` (única).
- **Relações**:
  - `roteador` – 1–1 com `Roteador`.

Serve para organizar a qual frota/cliente um determinado Mikrotik pertence.

## Dispositivo

Representa dispositivos finais (por exemplo, clientes conectando ao hotspot).

- **Campos típicos** (resumo):
  - Identificadores de dispositivo (MAC, IP, etc.).
  - Possível vínculo com `Frota` ou outros modelos, dependendo da versão do schema.

Este modelo é usado em fluxos de controle de acesso e em relatórios de uso.

## SessaoAtiva

Modela sessões ativas dos clientes no hotspot.

- **Tabela**: mapeada com `@@map("sessoes_ativas")`.
- **Campos** (resumo):
  - Identificador da sessão.
  - MAC/IP do cliente.
  - Horários de início/fim.

Permite saber quem está conectado e por quanto tempo.

## Config

Tabela de configuração global do sistema.

- Armazena chaves de configuração e valores (por exemplo, parâmetros de planos, URLs, chaves públicas, etc.).
- Útil para evitar hardcode de valores no código.

## Pedido e Charge

Modelos relacionados a pagamentos e cobrança.

### Pedido

- Representa a intenção de compra do cliente (plano, valor, identificação do cliente/dispositivo).
- Relaciona-se com `Charge` e com o fluxo de liberação de acesso após pagamento.

### Charge

- Representa a cobrança efetiva, com integração ao gateway de pagamento.
- Campos típicos incluem:
  - `status` – enum `ChargeStatus` (ex.: `PENDING`, `PAID`, `FAILED`).
  - Identificadores de transação no provedor externo.

Esses modelos são atualizados pelo webhook de pagamento e consultados pelos fluxos de liberação.

## WebhookLog

Tabela usada para registrar eventos de webhook (especialmente de pagamento/Pix).

- Permite rastrear chamadas recebidas, payloads relevantes e status de processamento.
- Útil para depuração quando houver divergência entre o gateway de pagamento e o estado do sistema.

## Enums importantes

### RoteadorStatus

Enum usado para representar o estado de conexões com Mikrotik/WireGuard.

- Exemplos de valores (consultar schema): `ONLINE`, `OFFLINE`, `ERRO`, `DESCONHECIDO`.
- Usado em `Roteador.statusMikrotik` e `Roteador.statusWireguard`.

### FrotaStatus

Enum para estado de uma frota (ativa, desativada, etc.).

### PaymentStatus / PaymentMethod / ChargeStatus

Enums relacionados ao estado de pedidos/cobranças e métodos de pagamento.

- Permitem acompanhar o ciclo de vida de um pagamento desde a criação até a confirmação/erro.

## Como usar este documento ao retomar o projeto

- Para entender o domínio: leia esta visão de alto nível e depois abra `prisma/schema.prisma` para ver os detalhes técnicos de cada campo.
- Para alinhar com os fluxos: combine este documento com `docs/fluxos-backend.md`.
- Para entender o estado atual e mudanças recentes: veja `docs/historico-tecnico.md`.
