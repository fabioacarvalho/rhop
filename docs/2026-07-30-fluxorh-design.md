# FluxoRH — Plataforma de Fluxos de Aprovação de RH com IA
### Design de hackathon (1 semana, 2-3 pessoas)

## 1. Contexto e problema

Hoje, processos de RH como abertura de vaga, férias e reembolso dependem de uma sequência de etapas manuais (solicitante → gestor → RH), sem nenhum sistema que:
- notifique automaticamente os responsáveis pela próxima aprovação;
- cobre aprovações pendentes que estão atrasando o processo;
- dê visibilidade em tempo real do status de cada solicitação.

Isso gera atrasos recorrentes e frustração — tanto de quem solicita quanto de quem precisa aprovar sem saber que há algo pendente.

## 2. Solução

Uma plataforma central de fluxos de aprovação de RH onde:

1. Qualquer colaborador abre uma solicitação (Vaga, Férias, Reembolso — extensível a outros tipos) num formulário simples.
2. A solicitação percorre etapas de aprovação definidas por tipo de fluxo (ex: Gestor → RH).
3. Cada aprovador recebe, junto com a solicitação, **um resumo gerado por IA** que destaca contexto, urgência e dados-chave — decide em segundos em vez de precisar ler/investigar tudo.
4. Todos os envolvidos veem em tempo real o status (pendente, atrasado, aprovado, rejeitado) sem precisar perguntar a ninguém.
5. Um **painel de insights** usa IA para analisar padrões agregados por tipo de fluxo (ex: concentração de vagas por área, tendências de reembolso).
6. Todas as ações e erros do sistema são registrados num log de auditoria/técnico, garantindo rastreabilidade.

**Critério de sucesso para o hackathon:** impacto de negócio percebido + o produto funcionando de ponta a ponta (MVP real, não apenas mockup).

## 3. Papéis e permissões

| Papel | Pode ver | Pode fazer |
|---|---|---|
| `SOLICITANTE` (todo colaborador) | Apenas as próprias solicitações | Abrir novas solicitações |
| `GESTOR` | As próprias solicitações + as da equipe que gerencia | Aprovar/rejeitar solicitações da equipe onde ele é o aprovador da etapa atual |
| `RH_ADMIN` | Todas as solicitações da empresa | Aprovar/rejeitar em qualquer etapa que exija RH; configurar tipos de fluxo e etapas; ver logs de auditoria/erro |

Todo usuário tem um `gestor_id` (exceto o topo da hierarquia), que define quem é "sua equipe" para fins de visibilidade e aprovação.

## 4. Modelo de dados

| Entidade | Campos-chave | Observações |
|---|---|---|
| `User` | id, nome, email, role, gestor_id | `role` ∈ {SOLICITANTE, GESTOR, RH_ADMIN} |
| `TipoFluxo` | id, nome, campos_formulario (JSON), etapas (lista ordenada de papéis aprovadores) | Ex: Vaga → etapas [GESTOR, RH_ADMIN] |
| `Solicitacao` | id, tipo_fluxo_id, solicitante_id, dados (JSON), status, etapa_atual, criado_em, prazo_sla | `dados` guarda as respostas do formulário dinâmico |
| `Aprovacao` | id, solicitacao_id, etapa, aprovador_role, aprovador_id, decisao, resumo_ia, decidido_em | Uma linha por etapa percorrida |
| `Log` | id, tipo (AUDITORIA \| ERRO), entidade, entidade_id, acao, usuario_id, detalhes (JSON), criado_em | Modelo único cobrindo auditoria de negócio e log técnico |

O uso de campos JSON (`dados`, `campos_formulario`, `detalhes`) permite que novos tipos de fluxo sejam adicionados sem alterar o schema do banco — só criando um novo registro de `TipoFluxo`.

## 5. Telas (MVP)

1. **Login** — auth simples (Supabase Auth, e-mail/senha).
2. **Minhas Solicitações** — lista das solicitações abertas pelo usuário, com status visual e botão "Nova Solicitação".
3. **Nova Solicitação** — escolha do tipo de fluxo → formulário dinâmico renderizado a partir de `campos_formulario`.
4. **Aprovações Pendentes** (Gestor/RH) — cards com o resumo gerado por IA em destaque, link para detalhes completos, botões Aprovar/Rejeitar com comentário opcional.
5. **Dashboard de Visão Geral** — contadores (pendentes, atrasados, aprovados, rejeitados) e lista filtrável por tipo, status e solicitante. Gestor vê a equipe; RH vê tudo.
6. **Painel de Insights** — filtro por tipo de fluxo e período; gráfico quantitativo (ex: contagem por categoria/área) + resumo em linguagem natural gerado por IA explicando o padrão principal.
7. **Configuração de Fluxos** (RH_Admin) — criar/editar `TipoFluxo`: nome, campos do formulário, etapas de aprovação (listas simples, sem canvas visual).
8. **Auditoria/Logs** (RH_Admin) — tabela filtrável por tipo (auditoria/erro), entidade, usuário e período.

## 6. Fluxo ponta a ponta (exemplo: Vaga)

1. Solicitante abre "Nova Solicitação" → escolhe "Vaga" → preenche o formulário.
2. Sistema cria a `Solicitacao` na etapa 1 (Gestor) → chama a IA para gerar o `resumo_ia` → notifica o gestor (in-app + e-mail) → grava log de auditoria.
3. Gestor vê no painel de Aprovações Pendentes, lê o resumo, aprova.
4. Sistema avança para etapa 2 (RH_Admin) → gera novo resumo → notifica RH → grava log.
5. RH aprova → status muda para "Aprovado" → solicitante é notificado → log final.

Se qualquer etapa passar do `prazo_sla` (ex: 48h) sem decisão, um job periódico marca a solicitação como "atrasada" e reenvia notificação de cobrança ao aprovador responsável.

## 7. Arquitetura técnica

| Camada | Escolha | Motivo |
|---|---|---|
| Frontend + Backend | Next.js (React + API Routes) | Um único projeto/deploy — menos tempo de setup no hackathon |
| Banco de dados + Auth | PostgreSQL via Supabase | Auth pronta, economiza dias de trabalho |
| ORM | Prisma | Schema tipado, migrations rápidas, suporta campos JSON |
| IA | OpenAI API (gpt-4o-mini), chamadas só no backend | Custo/latência baixos, nunca expor a chave no frontend |
| E-mail | Resend (ou Nodemailer + SMTP) | Setup rápido, plano free suficiente |
| Job de SLA | node-cron ou Vercel Cron chamando um endpoint de "check" | Marca atrasos e dispara cobrança periodicamente |
| Gráficos | Recharts | Simples de integrar em React |
| Deploy | Vercel | Deploy quase automático, bom para demo ao vivo |

**Fluxo de dados da IA (resumo por solicitação):** ao avançar de etapa, uma API route monta um prompt com os dados da solicitação e o contexto do tipo de fluxo, chama a OpenAI, e salva o resultado em `Aprovacao.resumo_ia`.

**Fluxo de dados dos Insights:** o backend agrega as `Solicitacao` do tipo/período escolhido (queries de agregação no Postgres, sem IA), monta um payload numérico compacto, e chama a OpenAI apenas para gerar o texto explicativo a partir dos números já calculados.

### 7.1 Organização do backend

Arquitetura em camadas simples, sem sobre-engenharia (nada de Clean Architecture completa — o prazo não comporta):

- **Routes** (API Routes do Next.js) — recebem a requisição HTTP, validam entrada (ex: com Zod), checam autenticação/autorização básica, e delegam para a camada de serviço. Não têm lógica de negócio.
- **Services** — contêm a lógica de negócio: avançar etapa de uma solicitação, checar se o usuário pode aprovar, montar prompt e chamar a IA, calcular agregações para os insights, disparar notificação. Cada fluxo (Solicitacoes, Aprovacoes, Insights, Notificacoes, Auditoria) tem seu próprio service.
- **Prisma (camada de dados)** — acesso ao banco, sem lógica de negócio misturada.

Essa separação é suficiente para manter o código organizado durante o hackathon sem gastar tempo com abstrações que não serão reaproveitadas (interfaces, injeção de dependência formal, etc.).

### 7.2 Docker (opcional, escopo de desenvolvimento)

Docker é usado apenas para padronizar o ambiente de desenvolvimento local, não para produção:
- Um `docker-compose.yml` simples pode subir um Postgres local (útil se o time não quiser depender do Supabase durante o desenvolvimento).
- Produção continua em Supabase (banco + auth) e Vercel (deploy), evitando o custo de configurar e manter infraestrutura própria em containers durante a semana do hackathon.

## 8. Tratamento de erros e casos de borda

- **Falha na chamada de IA** (timeout, erro de API): a solicitação segue normalmente; o aprovador vê os dados brutos em vez do resumo. A IA nunca pode travar o fluxo. Registrado como `Log` tipo `ERRO`.
- **Aprovador fora de etapa:** tentativa de aprovar uma solicitação que não está na etapa dele é bloqueada no backend (autorização por role + etapa atual).
- **Colaborador sem gestor cadastrado:** erro claro no momento de criar a solicitação, em vez de a solicitação ficar "perdida" sem aprovador definido.
- **Falha no envio de e-mail:** a notificação in-app ainda ocorre; a falha de e-mail é registrada como log de erro, não bloqueia o fluxo.

## 9. Logging (auditoria + técnico)

Um único modelo `Log`, diferenciado pelo campo `tipo`:
- **AUDITORIA:** toda transição de status de solicitação, toda decisão de aprovação/rejeição, toda edição de `TipoFluxo`.
- **ERRO:** toda falha de chamada de IA, toda falha de notificação/e-mail, exceções não tratadas relevantes.

Visível via a tela de Auditoria/Logs para RH_Admin — reforça a narrativa de "nada se perde silenciosamente", que é o oposto do problema original.

## 10. Escopo do hackathon — o que fica de fora (YAGNI)

Para viabilizar um MVP funcional de ponta a ponta em 1 semana com 2-3 pessoas, os seguintes itens **não** entram nesta versão:
- Motor de workflow visual (canvas de arrastar-e-soltar) — configuração de etapas é feita por formulário/lista simples.
- Múltiplos aprovadores em paralelo numa mesma etapa (só aprovador sequencial, um por etapa).
- Anexos de arquivo (ex: recibo de reembolso como upload) — pode ser um campo de texto/link no MVP.
- Notificação via Slack/Teams — apenas in-app + e-mail.
- Multi-empresa (multi-tenant) — a demo assume uma única empresa.

Esses itens são candidatos naturais para "próximos passos" no pitch, caso o time queira mostrar visão de roadmap.

## 11. As duas features de IA (destaque para o pitch)

1. **Resumo/justificativa por solicitação** (hero feature): agiliza a decisão do aprovador, resolvendo a dor de "preciso investigar o pedido antes de decidir".
2. **Painel de Insights agregados**: gráfico + resumo em linguagem natural por tipo de fluxo, mostrando padrões (ex: concentração de vagas por área, tendências de reembolso) — reforça a narrativa de "IA generativa aplicada a dados reais da empresa".
