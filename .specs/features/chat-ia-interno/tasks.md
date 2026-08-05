# Chat IA Interno - Tasks

## Tarefas de Implementação

- `[ ]` **TASK-001**: Criar o componente `ChatIAFab.tsx` em `app/_components/chat/` (ou `app/(dashboard)/_components/`). O botão deve ser fixo na tela (`position: fixed; right: 26px; bottom: 90px`) acima do botão de ajuda existente.
- `[ ]` **TASK-002**: Criar o layout e componente visual `ChatIAPanel.tsx` que abre ao clicar no FAB. Incluir um cabeçalho, uma área scrollável para mensagens e um input text com botão de enviar. Adicionar o hook `useChat` da Vercel AI SDK.
- `[ ]` **TASK-003**: Adicionar o componente `ChatIAFab` (que encapsula o `ChatIAPanel` renderizado condicionalmente) no `layout.tsx` principal do sistema.
- `[ ]` **TASK-004**: Criar a API route `app/api/chat/route.ts` utilizando a Vercel AI SDK (`ai` e `@ai-sdk/openai`). Implementar o system prompt básico para bloquear perguntas externas.
- `[ ]` **TASK-005**: Obter o contexto de autorização atual na API route (identificando usuário logado e papel via token/sessão).
- `[ ]` **TASK-006**: Criar a tool `get_indicadores_dashboard` no bloco de ferramentas da `streamText`. Ela deve realizar uma contagem no Prisma baseada no papel do usuário.
- `[ ]` **TASK-007**: Criar a tool `get_solicitacoes_pendentes` no bloco de ferramentas. Ela deve buscar as aprovações pendentes/atrasadas na tabela do Prisma.
- `[ ]` **TASK-008**: Ajustar visual do chat utilizando os tokens do sistema: `var(--amarelo-100)` para os balões de IA, `var(--azul-100)` para o usuário, e fontes corretas (Inter/Fraunces).

## Critérios de Validação / UAT
- O painel abre e fecha corretamente.
- A IA responde de forma coerente e formatada as perguntas internas.
- A IA recusa responder "Qual a capital do Brasil?".
- O usuário `Gestor` só recebe informações das solicitações da sua equipe quando pergunta "Quais são as minhas pendências?".
