# Chat IA Interno

## Visão Geral
Um assistente virtual contextualizado ("Chat IA") com os dados internos do sistema OP Conecta (FluxoRH). O usuário pode acionar a IA e fazer perguntas em linguagem natural sobre indicadores, status de solicitações e urgências (ex: "Quais aprovações estão pendentes que precisam de urgência?"). O assistente só utilizará dados internos e será bloqueado para perguntas externas.

## Requisitos (Traceability)

| ID | Requisito | Regras de Negócio / Critérios |
|----|-----------|-------------------------------|
| **CHAT-001** | **Ponto de Acesso (FAB)** | Adicionar um botão flutuante (FAB) do Chat IA logo acima do botão de ajuda existente (`#help-fab`), no canto inferior direito. |
| **CHAT-002** | **Interface do Chat** | Ao clicar no botão, abrir um painel lateral flutuante (Sidebar/Drawer) ou Modal, seguindo os tokens do Design System do FluxoRH. |
| **CHAT-003** | **Estilo Visual e UX** | A interface do chat deve usar os tokens de IA do sistema (`--amarelo-100`, `--amarelo-600`, `--amarelo-700`) para as mensagens da IA, garantindo coesão visual e o estilo "institucional". |
| **CHAT-004** | **Restrição de Escopo (Internal Data Only)** | A IA deve apenas consultar informações do banco de dados (Prisma/PostgreSQL). O prompt de sistema (`system prompt`) deve restringi-la estritamente ao contexto de RH do usuário e negar perguntas externas. |
| **CHAT-005** | **Autorização de Dados** | As consultas feitas pela IA (via Tools/Functions) devem respeitar as regras de visibilidade do usuário logado (Gestor vê sua equipe, RH_Admin vê tudo, Solicitante vê suas solicitações). |
| **CHAT-006** | **Capacidades de Consulta** | A IA deve ser capaz de responder a: (1) Indicadores do dia/dashboard, (2) Listar aprovações pendentes e atrasadas (SLA), (3) Informações sobre solicitações específicas do usuário. |

## Fora de Escopo
- Integração com bases de conhecimento de arquivos não estruturados (ex: PDFs de políticas).
- Realizar ações destrutivas ou de escrita (Aprovar/Rejeitar) via chat nesta primeira versão. A versão atual deve ser apenas leitura (Read-Only).

## Referências de Design
- Utilizar regras do `frontend-design` e `ui-ux-pro-max` (Animações de entrada para o chat, sombras corretas `box-shadow: var(--shadow)`).
- O FAB do Chat IA pode ser da cor secundária `var(--azul-800)` ou usar a cor destaque de IA `var(--amarelo-600)` com ícone em `var(--azul-900)` para diferenciá-lo do botão de ajuda.
