# PRD — Banco de Talentos (Triagem de Currículos com IA)
### Módulo novo dentro do RHOP — RH Obra Prima

> Este PRD assume o contexto e as convenções já definidas em [`docs/2026-07-30-fluxorh-design.md`](./2026-07-30-fluxorh-design.md) e [`CLAUDE.md`](../CLAUDE.md). Não repete decisões de stack, papéis ou padrões já estabelecidos lá — só referencia onde herda e onde estende.

## 1. Resumo executivo

Uma nova aba dentro do RHOP onde RH e Gestores cadastram candidatos (currículo + transcrição de entrevista) e buscam, em linguagem livre, o perfil que precisam — recebendo um ranking (Top N customizável) de candidatos mais aderentes, com justificativa gerada por IA para cada posição.

## 2. Problema e objetivo

Hoje, cruzar currículo e entrevista pra avaliar um candidato é manual: alguém lê o currículo, reassiste ou relê a transcrição da entrevista, e decide "na cabeça" se aquilo atende ao que a vaga precisa. Isso é lento e inconsistente entre avaliadores diferentes.

**Objetivo:** permitir que RH/Gestor descreva o perfil que procura em texto livre e receba, em segundos, um ranking objetivo e explicado dos candidatos mais aderentes já cadastrados na base.

## 3. Como se relaciona com o RHOP existente

- **Reaproveita:** papéis e autenticação (`User`, `role`), padrão de logging (`Log` com `tipo` AUDITORIA/ERRO), padrão de resiliência de IA (falha de IA nunca trava a operação), arquitetura em camadas (Routes → Services → Prisma), e o `iaService` já existente (ganha uma função nova).
- **Vínculo opcional:** um `Candidato` pode apontar para uma `Solicitacao` (Vaga) existente, mas a busca/ranking nunca depende desse vínculo — funciona como busca livre independente.
- **Não interfere** no fluxo de aprovação de Vaga/Férias/Reembolso já especificado — é um módulo adicional, não uma alteração no que já existe.

## 4. Usuários e permissões

| Papel | Acesso ao módulo |
|---|---|
| `SOLICITANTE` | Nenhum |
| `GESTOR` | Cadastra candidatos, busca/ranqueia, vê detalhes |
| `RH_ADMIN` | Mesmo acesso do Gestor, para todos os candidatos |

Diferente do fluxo de aprovação, aqui não há distinção de "próprios vs equipe" — Gestor e RH_Admin veem a base de candidatos inteira, já que o objetivo é colaborativo (encontrar o melhor candidato, independente de quem cadastrou).

## 5. Requisitos funcionais (priorizados)

### P0 — Núcleo (sem isso, o módulo não existe)
- RF1. Cadastrar candidato com nome, e-mail, telefone, texto do currículo (colado) e texto da transcrição da entrevista (colado).
- RF2. Ao cadastrar, gerar automaticamente um embedding do conteúdo combinado (currículo + transcrição) e salvar associado ao candidato.
- RF3. Tela de busca: campo de texto livre (perfil desejado) + campo numérico "quantos resultados" (padrão 20) → retorna ranking ordenado por similaridade.
- RF4. Para cada candidato do ranking retornado, gerar (via IA) uma justificativa textual de por que ele ficou naquela posição.
- RF5. Listar todos os candidatos cadastrados, com status do embedding (processado/pendente/falhou).

### P1 — Estende o núcleo (entra se P0 estiver estável)
- RF6. Aceitar upload de currículo em PDF, com extração automática de texto (em vez de exigir colar o texto manualmente).
- RF7. Permitir vincular um candidato a uma `Solicitacao` (Vaga) existente no momento do cadastro ou depois.

### P2 — Enriquecimento (corta primeiro se necessário)
- RF8. Tela de detalhe do candidato com currículo completo, transcrição completa e histórico de buscas em que apareceu bem rankeado.

## 6. Fora de escopo (não implementar sem confirmar)

- Integração automática com a API do Google Meet/Workspace para captura de transcrição (a transcrição é colada manualmente, já gerada externamente pelo Meet).
- Múltiplos currículos ou múltiplas transcrições por candidato (um de cada, por candidato, nesta versão).
- Edição/reprocessamento em lote de embeddings antigos se o modelo de embedding mudar no futuro.
- Qualquer decisão automática de aprovação/reprovação de candidato — o módulo apenas ranqueia e explica, a decisão final é humana.

## 7. Modelo de dados

Nova entidade, adicionada ao schema já existente (`docs/2026-07-30-fluxorh-design.md`, seção 4):

| Entidade | Campos-chave | Observações |
|---|---|---|
| `Candidato` | id, nome, email, telefone, curriculo_texto, curriculo_arquivo_url (opcional), transcricao_texto, embedding (vector), status_embedding (pendente/processado/falhou), solicitacao_id (opcional, FK), criado_por, criado_em | `embedding` gerado a partir de `curriculo_texto` + `transcricao_texto` combinados |

**Nota técnica:** a coluna `embedding` usa o tipo `vector` do Postgres (extensão `pgvector`), modelada no Prisma como `Unsupported("vector(1536)")`. Leitura/escrita e a busca por similaridade são feitas via `prisma.$queryRaw`, não pela API padrão do Prisma — documentar isso no `CLAUDE.md` para quem for gerar o código não estranhar essa exceção à regra geral de acesso a dados.

## 8. Fluxos principais

### 8.1 Cadastro de candidato
1. RH/Gestor preenche nome, e-mail, telefone.
2. Currículo: cola o texto, ou (P1) sobe um PDF → texto extraído automaticamente e exibido para conferência.
3. Cola o texto da transcrição da entrevista.
4. (P1, opcional) vincula a uma `Solicitacao` existente.
5. Ao salvar: candidato é criado com `status_embedding = pendente`; embedding é gerado em background; se sucesso, `status_embedding = processado`; se falha, `status_embedding = falhou` e grava `Log` tipo `ERRO` — candidato continua salvo e visível na lista, só fica fora de buscas até reprocessar.

### 8.2 Busca e ranking
1. Usuário digita o perfil desejado em texto livre e define quantos resultados quer (N).
2. Backend gera embedding da busca.
3. Query no Postgres via `pgvector` (`ORDER BY embedding <=> :query_embedding LIMIT N`), considerando apenas candidatos com `status_embedding = processado`.
4. Para os N resultados, backend chama a IA para gerar a justificativa textual de cada um.
5. Tela exibe: nome, e-mail, vaga vinculada (se houver), score de similaridade, justificativa, link para detalhe.

## 9. Arquitetura técnica

| Peça | Escolha |
|---|---|
| Vetor/similaridade | `pgvector` (extensão Postgres, Supabase) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Extração de PDF (P1) | `pdf-parse` (server-side) |
| Armazenamento de arquivo (P1) | Supabase Storage, bucket `curriculos` |

**Novos services** (mesma camada Routes → Services → Prisma):
- `candidatoService.ts` — CRUD, orquestra extração de PDF (P1) e chama `embeddingService` ao criar.
- `embeddingService.ts` — encapsula chamada à API de embeddings da OpenAI.
- `talentoSearchService.ts` — orquestra a busca: embedding da query → `$queryRaw` de similaridade → top N → chama `iaService`.
- `iaService.ts` (existente) — ganha `gerarJustificativaRanking(candidato, queryTexto)`.

**Novas rotas:** `POST/GET /api/candidatos`, `GET /api/candidatos/[id]`, `POST /api/candidatos/busca`.

## 10. Casos de erro e resiliência

- Falha ao gerar embedding no cadastro → candidato salvo com `status_embedding = falhou`, log de erro, fora de buscas até reprocessar (não bloqueia o cadastro).
- Falha ao gerar justificativa de IA para algum item do ranking → ranking é exibido normalmente, item aparece sem justificativa.
- Busca sem nenhum candidato com `status_embedding = processado` → mensagem clara de "nenhum candidato disponível para busca ainda", não erro.
- (P1) Falha na extração de texto do PDF → erro claro no formulário, orienta a colar o texto manualmente.

## 11. Critérios de aceite (Definition of Done do módulo)

- Cadastrar um candidato com texto colado gera embedding com sucesso e ele aparece disponível para busca.
- Buscar um perfil retorna um ranking coerente (candidatos com conteúdo mais próximo do texto buscado aparecem nas primeiras posições) com justificativa de IA para cada um.
- Alterar o N de resultados muda a quantidade retornada corretamente.
- Falha simulada de IA (na geração de embedding ou de justificativa) não impede o cadastro nem a busca de funcionar, e gera `Log` tipo `ERRO`.
- (P1) Upload de PDF extrai texto corretamente para um currículo de teste padrão (texto puro, não escaneado).

## 12. Riscos e dependências

- **Modelo de dados vetorial é uma peça nova de infraestrutura** (pgvector) — validar cedo que o projeto Supabase suporta a extensão antes de depender dela no restante do módulo.
- **Qualidade do ranking depende da qualidade do texto de entrada** — transcrições muito curtas ou currículos muito genéricos produzem embeddings menos discriminativos; não há solução de escopo pra isso além de aceitar a limitação na demo.
- **Todo o módulo depende da API da OpenAI** (embeddings + justificativas) — já mitigado pelo padrão de resiliência já adotado no resto do RHOP (nunca travar por falha de IA).

## 13. Documentos relacionados

- [Design completo do RHOP](./2026-07-30-fluxorh-design.md)
- [`CLAUDE.md`](../CLAUDE.md) — convenções gerais de código
- [Plano de tarefas para Claude Code](./2026-07-30-fluxorh-tarefas-claude-code.md) — tarefas do fluxo de aprovação; este módulo pode virar uma sequência de tarefas própria (Tarefas 18+) seguindo o mesmo formato, se desejado