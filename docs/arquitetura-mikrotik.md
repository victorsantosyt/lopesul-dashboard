# Arquitetura Mikrotik / Hotspot / WireGuard

Este documento resume a arquitetura de rede e integrações Mikrotik, servindo como visão geral rápida. Para detalhes de passo a passo, ver os arquivos de configuração completos na raiz do projeto.

## Visão geral

- **Objetivo**: controlar acesso Wi-Fi via hotspot Mikrotik, planos pagos (Pix) e liberações automáticas de acesso.
- **Componentes principais**:
  - **Painel / Backend**: aplicação Next.js (API Routes) rodando no VPS.
  - **Banco de dados**: PostgreSQL (Railway) acessado via Prisma.
  - **Mikrotik(s)**: roteadores que fazem o hotspot e aplicam as regras de bloqueio/liberação.
  - **Relay / API Mikrotik**: serviço intermediário que fala com a API Mikrotik (porta 8728) e aplica liberação de MAC/usuários.
  - **WireGuard**: túnel entre VPS e Mikrotik para acesso seguro à API e à LAN.

O fluxo completo de um cliente é:

1. Cliente conecta na rede Wi-Fi controlada pelo Mikrotik (hotspot).
2. Mikrotik redireciona o usuário para a página de pagamento/portal do painel.
3. O painel registra um **pedido** e inicia o fluxo de pagamento (Pix / Pagar.me).
4. Ao receber a confirmação de pagamento (webhook), o backend chama o **relay** para liberar o acesso desse cliente no Mikrotik (com base em MAC/IP).
5. O Mikrotik atualiza suas regras (address-list, queue, etc.), e o cliente passa a navegar.

## Comunicação com os Mikrotiks

Existem dois canais principais de comunicação com os Mikrotiks:

1. **API Mikrotik (porta 8728)**
   - Usada pelo relay e/ou scripts Node para aplicar comandos no roteador.
   - Operações típicas:
     - Criar/atualizar usuários hotspot.
     - Adicionar MAC/IP em listas de autorização.
     - Remover bloqueio após expiração.

2. **WireGuard**
   - Cria um túnel entre o VPS e a LAN dos Mikrotiks.
   - Permite que o backend/relay alcancem a API Mikrotik e IPs internos mesmo em cenários mais restritos.
   - Configuração e sincronização de peers centralizada em `src/lib/wireguard.ts`.

## Hotspot Mikrotik

- O Mikrotik é configurado como **Hotspot**:
  - Cria-se um servidor hotspot (interface Wi-Fi/LAN de clientes).
  - Define pool de IPs para clientes.
  - Habilita redirecionamento para uma URL externa (o painel).
- O login HTML do hotspot é customizado para redirecionar o cliente ao painel, carregando **parâmetros como MAC e IP**.
- Após o pagamento, a liberação do cliente é feita aplicando comandos na API Mikrotik (via relay), usando esses identificadores.

> Para detalhes de configuração, ver na raiz do projeto:
>
> - `CONFIGURACAO_COMPLETA.md`
> - `SETUP-COMPLETO.md`
> - `CONFIGURAR_HOTSPOT_MIKROTIK.rsc`
> - `mikrotik-hotspot-config.rsc`
> - `mikrotik-hotspot-login.html`

## Integração WireGuard

A lógica de integração com o gerenciador de WireGuard está centralizada em:

- `src/lib/wireguard.ts`

Responsabilidades principais:

- Manter peers WireGuard sincronizados (criação/atualização/remoção) via HTTP para um **WG Manager** local/remoto.
- Utilizar tokens e URL configurados via variáveis de ambiente (`WG_MANAGER_URL`, `WG_MANAGER_TOKEN`).
- Registrar logs detalhados com prefixo `[wireguard]`, incluindo possíveis motivos de falha:
  - Token ausente.
  - URL ausente.
  - `publicKey` ausente.
  - Erros HTTP do WG Manager.

Essa integração é usada pelos fluxos de criação/edição de roteadores que possuem WireGuard configurado, permitindo que o painel e o relay alcancem os Mikrotiks pela rede interna do túnel.

## Multi-Mikrotik

A arquitetura suporta múltiplos roteadores Mikrotik:

- Cada Mikrotik é representado como um **Roteador** no banco (modelo `Roteador` em `prisma/schema.prisma`).
- O painel é capaz de:
  - Listar todos os roteadores.
  - Consultar status individual (alcance API/ping/identidade).
  - Manter campos de integração WireGuard (chaves, IP dentro do túnel, etc.).
- A página `/roteadores/debug` oferece uma visão de diagnóstico em tempo real dos roteadores cadastrados.

Para mais detalhes de como o backend expõe esses fluxos, ver `docs/fluxos-backend.md`.
