# Histórico Técnico – Lopesul Dashboard

Este arquivo consolida os principais marcos técnicos do projeto, com foco em decisões de arquitetura, alterações de fluxo backend e estado atual do sistema.

> Dica: ao finalizar sessões de trabalho importantes, adicione uma nova seção datada aqui.

---

## 2025-11-16 – Debug de Roteadores + Integração WireGuard

### Contexto

- O painel de roteadores (`/roteadores`) estava travado em "Carregando..." em produção.
- Era necessário ter uma forma clara de diagnosticar, em tempo real, o status de cada Mikrotik cadastrado.
- Também foi centralizada a integração com WireGuard para simplificar logs e troubleshooting.

### Mudanças principais

1. **Correção do painel /roteadores travado**
   - Problema identificado: o Next.js estava servindo um **build antigo**, apontando para um chunk JS que retornava HTTP 400.
   - Ação: reinicialização do processo via PM2 para carregar o **build mais recente**.
   - Resultado: a tela `/roteadores` voltou a carregar a lista normalmente em produção.

2. **Testes reais contra painel + Mikrotiks**
   - Rotas exercitadas em produção:
     - `GET /api/roteadores` → lista de Mikrotiks de lab.
     - `GET /api/roteadores/:id/status` → checagem de status (API/ping/identidade via relay).
   - Situação observada na data:
     - Um Mikrotik de lab **ONLINE** (API acessível, ping OK, identidade retornando "MikroTik").
     - Outro Mikrotik de lab **OFFLINE** (sem TCP/ping).
   - Também foi criado um roteador de teste via `POST /api/roteadores` e removido depois via `DELETE /api/roteadores/:id` para validar o fluxo completo.

3. **Integração com WireGuard centralizada**
   - Criado (ou consolidado) o módulo:
     - `src/lib/wireguard.ts`
   - Responsabilidades:
     - Centralizar chamadas HTTP ao **WG Manager** (ex.: criação/remoção de peers).
     - Usar variáveis de ambiente `WG_MANAGER_URL` e `WG_MANAGER_TOKEN`.
     - Retornar estrutura padronizada `{ ok, skipped?, reason?, status?, body? }`.
     - Incluir logs detalhados com prefixo `[wireguard]`, por exemplo:
       - `wg_manager_token_missing`
       - `wg_manager_url_missing`
       - `public_key_missing`
       - Erro HTTP na comunicação.
   - Impacto nos fluxos:
     - Ao criar/editar roteadores com campos WireGuard (`wgPublicKey`, `wgIp`), a lógica de sync passa por esse módulo, facilitando entender por que o `statusWireguard` ficou `ONLINE`, `OFFLINE` ou `ERRO`.

4. **Nova página de debug de roteadores**
   - Rota criada: `/roteadores/debug`.
   - Arquivo principal:
     - `src/app/roteadores/debug/page.jsx`
   - Funcionalidades:
     - Carregar todos os roteadores via `GET /api/roteadores`.
     - Permitir testar o status de cada roteador individualmente ou de todos em sequência, chamando `GET /api/roteadores/:id/status`.
     - Exibir, em JSON formatado, o resultado de cada chamada, incluindo `httpStatus`, `mikrotikOnline`, `pingOk`, `identity`, etc. (de acordo com a resposta do endpoint de status).
   - Objetivo: servir como **painel de diagnóstico** para ver ao vivo se o painel está conseguindo falar com cada Mikrotik.

5. **Acesso rápido ao debug**
   - Na tela principal de roteadores (`/roteadores`), foi adicionado um botão **"Debug"** ao lado do botão **"Atualizar status"**.
   - Ao clicar, o usuário é direcionado para `/roteadores/debug` para executar os testes.

6. **Build, deploy e versionamento**
   - Comando de build executado sem erros:
     - `npm run build`
   - Deploy aplicado via PM2:
     - `pm2 restart lopesul-dashboard`
   - As mudanças foram commitadas e enviadas para a branch `main` com uma mensagem semelhante a:
     - `Add roteadores debug page and improve WireGuard integration`

### Estado atual do projeto (após estas mudanças)

- Painel `/roteadores` funcionando em produção.
- Página `/roteadores/debug` disponível para diagnóstico de Mikrotiks em tempo real.
- Integração com WireGuard consolidada em `src/lib/wireguard.ts` com logs padronizados.
- Modelo `Roteador` em `prisma/schema.prisma` contemplando campos de WireGuard e status, usado diretamente pelos endpoints de roteadores.

---

## Como manter este histórico útil

Sempre que houver mudanças significativas, adicionar uma nova seção com:

1. Data.
2. Contexto (qual problema ou objetivo motivou a alteração).
3. Mudanças principais (arquivos, rotas, modelos afetados).
4. Estado atual do sistema após a mudança (o que está funcionando, o que ainda está pendente).

Isso permite que uma nova sessão de IA (ou um novo desenvolvedor) reconstrua rapidamente onde o projeto parou, sem depender do histórico de conversas.
