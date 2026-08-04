# Banco de Talentos Specification

> Feature `banco-de-talentos` (prefixo `TAL`) — módulo novo de triagem de currículos com IA.
> Fonte da verdade: `docs/prd/2026-07-30-banco-de-talentos-prd.md`, `docs/2026-07-30-fluxorh-design.md` e `CLAUDE.md` (regras invioláveis).
>
> **Rodada 2 (esta revisão)**: P1 (Cadastrar/Listar/Buscar) já está implementado. Esta revisão (1) troca o campo "transcrição da entrevista" por "parecer técnico" no cadastro, (2) adiciona classificação por Tags (entidade nova + tela de gestão), (3) adiciona upload de currículo em PDF/Word/Markdown como alternativa ao texto colado, e (4) documenta importação de planilhas como item **fora de escopo nesta rodada**, apenas para compatibilidade futura. Ver `Changelog` ao final.

## Problem Statement

Cruzar currículo e avaliação técnica do candidato para avaliar aderência à vaga é hoje manual: alguém relê os textos e decide "na cabeça" se atende à vaga. É lento e inconsistente entre avaliadores. Este módulo permite RH/Gestor descrever o perfil desejado em texto livre e receber, em segundos, ranking objetivo de candidatos já cadastrados, com justificativa gerada por IA. A classificação por Tags e o upload direto de currículo agilizam ainda mais o cadastro e a triagem manual da lista.

## Goals

- [ ] RH/Gestor cadastra candidato (nome, e-mail, telefone, currículo colado ou enviado como arquivo, parecer técnico) e o embedding é gerado automaticamente, sem bloquear o cadastro em caso de falha de IA.
- [ ] RH/Gestor busca por perfil em texto livre e recebe ranking Top N (customizável) ordenado por similaridade, com justificativa textual por candidato.
- [ ] Falha de IA (embedding ou justificativa) nunca impede cadastro nem busca — segue padrão de resiliência já adotado no RHOP.
- [ ] RH/Gestor classifica candidatos com uma ou mais Tags (ex: senioridade, área) para facilitar triagem visual na listagem e no ranking.
- [ ] RH_Admin gerencia o catálogo de Tags (criar, editar, ativar/desativar) em tela própria, sem depender de alteração de código.
- [ ] RH/Gestor sobe o currículo como arquivo (PDF, Word ou Markdown) e tem o texto extraído automaticamente para conferência, sem perder a opção de colar o texto manualmente.

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Reason |
| --- | --- |
| Captura automática de parecer técnico (integração com ferramenta externa) | Parecer técnico sempre colado/escrito manualmente pelo avaliador, nesta versão. |
| Múltiplos currículos por candidato | PRD §6 — um currículo por candidato nesta versão (texto e/ou arquivo, nunca vários arquivos). |
| Reprocessamento em lote de embeddings antigos se o modelo mudar | PRD §6 — fora de escopo. |
| Decisão automática de aprovação/reprovação de candidato | PRD §6 — módulo só ranqueia e explica; decisão final é humana. |
| Vincular candidato a uma `Solicitacao` existente | RF7, P1 (estende o núcleo) — não faz parte deste ciclo. |
| Tela de detalhe do candidato + histórico de buscas | RF8, P2 (enriquecimento) — corta primeiro se necessário. |
| Distinção "próprios vs equipe" na visibilidade | PRD §4 — GESTOR e RH_ADMIN veem a base inteira; não há filtro por criador. |
| Edição ou exclusão de candidato após cadastro | Não descrito no PRD. Ver Questões em Aberto. |
| Edição de parecer técnico após cadastro (torná-lo opcional/preenchível depois) | Decisão desta rodada (`context.md`): parecer técnico continua obrigatório no cadastro, igual à transcrição antes — sem tela de edição posterior. |
| Importação de planilhas de candidatos (com planilha modelo) | Pedido explicitamente para ficar fora desta rodada — só "para coincidir depois". Nomes de campo do `Candidato`/`Tag` desta revisão foram mantidos simples e planos de propósito, para não exigir remapeamento quando a importação for desenhada. Nenhum código de import é criado agora. |
| Reordenar/mesclar/hierarquizar Tags (ex: categorias de tag) | Decisão desta rodada: `Tag` é um catálogo plano (nome + função + ativo), sem hierarquia ou tipos estruturados. |

---

## User Stories

### P1: Cadastrar Candidato ⭐ MVP

**User Story**: Como GESTOR ou RH_ADMIN, quero cadastrar um candidato com nome, e-mail, telefone, currículo e parecer técnico, para que ele entre na base disponível para busca.

**Why P1**: É o ponto de entrada de dados do módulo — sem candidato cadastrado não há o que buscar/ranquear (PRD RF1, RF2).

> **Revisado nesta rodada**: o campo antes chamado "transcrição da entrevista" (`transcricao_texto`) passa a se chamar **"parecer técnico"** (`parecer_tecnico`) — mesmo campo de texto livre, mesma obrigatoriedade, mesmo papel na geração do embedding; só muda o nome do campo e o que ele representa (avaliação escrita pelo entrevistador/avaliador, não mais transcrição literal da conversa). Critérios abaixo já refletem o novo nome.

**Acceptance Criteria**:

1. WHEN um usuário com papel GESTOR ou RH_ADMIN submete o formulário de cadastro com nome, e-mail, telefone, currículo (texto colado ou arquivo enviado) e texto de parecer técnico THEN o system SHALL criar um `Candidato` com `status_embedding = pendente` e `criado_por` = usuário autenticado.
2. WHEN um usuário com papel SOLICITANTE tenta acessar o cadastro de candidato THEN o system SHALL negar o acesso no backend.
3. WHEN o `Candidato` é criado THEN o system SHALL disparar, de forma não bloqueante, a geração do embedding a partir de `curriculo_texto` + `parecer_tecnico` combinados.
4. WHEN a geração do embedding é bem-sucedida THEN o system SHALL atualizar `status_embedding` para `processado`.
5. WHEN a geração do embedding falha (timeout, erro, rate limit) THEN o system SHALL manter o `Candidato` salvo e visível, atualizar `status_embedding` para `falhou` e gravar `Log` tipo `ERRO` — a falha NUNCA impede o cadastro.
6. WHEN campos obrigatórios (nome, e-mail, telefone, currículo, parecer técnico) estão ausentes THEN o system SHALL rejeitar a submissão com mensagem clara e NÃO criar o `Candidato`.
7. WHEN o `Candidato` é criado com sucesso THEN o system SHALL gravar um `Log` tipo `AUDITORIA`.
8. WHEN o e-mail submetido já pertence a um `Candidato` existente THEN o system SHALL bloquear a criação com mensagem clara e NÃO criar um segundo `Candidato` com o mesmo e-mail.
9. WHEN o usuário seleciona uma ou mais Tags ativas durante o cadastro THEN o system SHALL vincular essas Tags ao `Candidato` criado.

**Independent Test**: Autenticar como GESTOR, cadastrar um candidato com texto colado válido e ao menos uma Tag, confirmar que aparece na lista com `status_embedding = pendente`, a Tag vinculada visível, e, após processamento, `processado`.

---

### P1: Listar Candidatos ⭐ MVP

**User Story**: Como GESTOR ou RH_ADMIN, quero ver todos os candidatos cadastrados com o status do embedding de cada um, para saber quem já está disponível para busca.

**Why P1**: É a tela que fecha o loop de confiança do cadastro — sem ela não dá pra verificar se o embedding processou (PRD RF5).

**Acceptance Criteria**:

1. WHEN um usuário GESTOR ou RH_ADMIN abre a lista de candidatos THEN o system SHALL retornar todos os candidatos cadastrados (sem filtro por `criado_por` — visibilidade colaborativa, PRD §4).
2. WHEN a lista é exibida THEN o system SHALL mostrar, para cada candidato, ao menos nome, e-mail, `status_embedding` (pendente/processado/falhou) e as Tags vinculadas (se houver).
3. WHEN um usuário SOLICITANTE tenta acessar a lista THEN o system SHALL negar o acesso no backend.
4. WHEN não há nenhum candidato cadastrado THEN o system SHALL exibir estado vazio, sem erro.
5. WHEN um candidato tem `status_embedding = falhou` THEN o system SHALL exibir uma ação "Reprocessar" naquela linha, ausente para os demais status.
6. WHEN o usuário aciona "Reprocessar" THEN o system SHALL disparar novamente a geração do embedding para aquele candidato, seguindo o mesmo tratamento de sucesso/falha do cadastro (TAL-04/TAL-05).

**Independent Test**: Cadastrar 2 candidatos com status diferentes (um processado, um pendente) e confirmar que ambos aparecem na lista com o status correto, para qualquer usuário GESTOR/RH_ADMIN, independente de quem cadastrou.

---

### P1: Buscar e Ranquear Candidatos ⭐ MVP

**User Story**: Como GESTOR ou RH_ADMIN, quero descrever em texto livre o perfil que procuro e definir quantos resultados quero, para receber um ranking dos candidatos mais aderentes com justificativa.

**Why P1**: É o valor central do módulo — o motivo de existir (PRD RF3, RF4).

**Acceptance Criteria**:

1. WHEN o usuário submete um texto de busca e um número N de resultados (padrão 20) THEN o system SHALL gerar o embedding do texto de busca.
2. WHEN o embedding da busca é gerado THEN o system SHALL consultar candidatos com `status_embedding = processado` ordenados por similaridade (`pgvector`, `ORDER BY embedding <=> :query_embedding LIMIT N`).
3. WHEN o ranking é retornado THEN o system SHALL, para cada candidato do Top N, chamar a IA para gerar justificativa textual da posição.
4. WHEN a tela exibe o ranking THEN o system SHALL mostrar nome, e-mail, vaga vinculada (se houver), Tags vinculadas (se houver), score de similaridade e justificativa de cada candidato.
5. WHEN não existe nenhum candidato com `status_embedding = processado` THEN o system SHALL exibir mensagem clara ("nenhum candidato disponível para busca ainda"), nunca erro não tratado.
6. WHEN a geração de justificativa de IA falha para um candidato específico THEN o system SHALL exibir esse candidato no ranking sem justificativa, sem quebrar o ranking dos demais.
7. WHEN um usuário SOLICITANTE tenta acessar a busca THEN o system SHALL negar o acesso no backend.
8. WHEN falha a geração do embedding da própria busca THEN o system SHALL gravar `Log` tipo `ERRO` e retornar mensagem clara ao usuário (busca não pode ser concluída sem embedding da query).
9. WHEN N é zero, negativo, não numérico, ou maior que o teto máximo configurável (padrão 100) THEN o system SHALL bloquear a busca com mensagem clara, sem executar a query.
10. WHEN os resultados são exibidos THEN o system SHALL apresentar cada candidato em um card com score de similaridade representado por barra visual + percentual.

**Independent Test**: Com ao menos 3 candidatos processados de perfis distintos, buscar um perfil específico e confirmar que o candidato mais aderente aparece em 1º lugar com justificativa coerente, e que mudar N muda a quantidade retornada.

---

### P1: Upload de Currículo (PDF, Word ou Markdown) ⭐ Nesta rodada

**User Story**: Como GESTOR ou RH_ADMIN, quero subir o currículo como arquivo (PDF, Word ou Markdown) em vez de colar o texto manualmente, para agilizar o cadastro.

**Why P1 nesta rodada**: Estende o núcleo (PRD RF6) — o cadastro já funciona via texto colado; promovido de P2 pra esta rodada, com formatos ampliados.

**Acceptance Criteria**:

1. WHEN o usuário sobe um arquivo de currículo em PDF, Word (`.docx`) ou Markdown (`.md`) THEN o system SHALL extrair o texto automaticamente e exibi-lo para conferência antes de salvar.
2. WHEN o usuário prefere colar o texto do currículo diretamente THEN o system SHALL continuar aceitando essa via, sem exigir upload de arquivo (coexistência, `context.md`).
3. WHEN a extração de texto falha (ex: PDF escaneado/imagem, arquivo corrompido) THEN o system SHALL exibir erro claro e orientar o usuário a colar o texto manualmente, sem bloquear o cadastro por outros meios.
4. WHEN o arquivo enviado não é PDF, `.docx` nem `.md` THEN o system SHALL rejeitar o upload com mensagem clara antes de tentar processar, sem bloquear o cadastro por texto colado.
5. WHEN o arquivo é processado com sucesso (qualquer um dos 3 formatos) THEN o system SHALL armazenar o arquivo original em Supabase Storage (bucket `curriculos`) e salvar a URL em `curriculo_arquivo_url`.

**Independent Test**: Subir um PDF de texto puro, depois um `.docx` e depois um `.md`, e confirmar em cada caso que o texto extraído bate com o conteúdo do arquivo antes de salvar; subir um `.png` e confirmar rejeição com mensagem clara.

---

### P1: Classificar Candidato com Tags ⭐ Nesta rodada

**User Story**: Como GESTOR ou RH_ADMIN, quero marcar um candidato com uma ou mais Tags (ex: senioridade, área, urgência) ao cadastrar ou consultar, para localizar e comparar candidatos mais rápido na listagem e no ranking.

**Why P1 nesta rodada**: Classificação visual reduz o retrabalho de reabrir currículo/parecer técnico só pra saber "que tipo" de candidato é aquele.

**Acceptance Criteria**:

1. WHEN o usuário cadastra um candidato THEN o system SHALL permitir selecionar zero ou mais Tags ativas para vincular a ele (many-to-many, `context.md`).
2. WHEN a listagem de candidatos é exibida THEN o system SHALL mostrar as Tags vinculadas a cada candidato como identificação visual (badge).
3. WHEN o ranking de busca é exibido THEN o system SHALL mostrar as Tags vinculadas a cada candidato do resultado.
4. WHEN uma Tag é desativada (`ativo = false`) THEN o system SHALL deixar de oferecê-la como opção para novos vínculos, mas SHALL manter o vínculo já existente em candidatos que já a possuem.
5. WHEN um usuário SOLICITANTE tenta usar qualquer rota deste módulo THEN o system SHALL negar o acesso no backend (mesma regra já aplicada ao restante do módulo).

**Independent Test**: Cadastrar um candidato com 2 Tags ativas, confirmar que ambas aparecem na listagem e no card de busca; desativar uma delas e confirmar que ela some das opções de um novo cadastro mas continua visível no candidato já vinculado.

---

### P1: Gerenciar Tags ⭐ Nesta rodada

**User Story**: Como RH_ADMIN, quero criar, editar e ativar/desativar Tags (nome + função) em uma tela própria, para manter o catálogo de classificação atualizado sem depender de alteração de código.

**Why P1 nesta rodada**: Sem essa tela, a classificação por Tags não teria de onde vir — é o cadastro de dados de apoio do requisito anterior.

**Acceptance Criteria**:

1. WHEN um usuário RH_ADMIN acessa a tela de gestão de Tags THEN o system SHALL listar todas as Tags cadastradas, com nome, função e status ativo/inativo.
2. WHEN um usuário RH_ADMIN submete o formulário de nova Tag com nome e função preenchidos THEN o system SHALL criar a Tag com `ativo = true` por padrão.
3. WHEN o nome da Tag já existe (em qualquer capitalização) THEN o system SHALL bloquear a criação/edição com mensagem clara (unicidade de nome, mesmo padrão de `TipoFluxo.nome`).
4. WHEN um usuário RH_ADMIN edita nome e/ou função de uma Tag existente THEN o system SHALL salvar a alteração, refletida em todos os candidatos já vinculados a ela (é o mesmo registro, não uma cópia).
5. WHEN um usuário RH_ADMIN alterna o status ativo/inativo de uma Tag THEN o system SHALL persistir a mudança imediatamente, sem excluir a Tag nem seus vínculos existentes.
6. WHEN um usuário GESTOR ou SOLICITANTE tenta acessar a tela ou as rotas de gestão de Tags THEN o system SHALL negar o acesso no backend — só RH_ADMIN gerencia (`context.md`).

**Independent Test**: Autenticar como RH_ADMIN, criar uma Tag "Sênior" / função "Nível de experiência", confirmar que aparece na lista ativa; tentar criar outra "sênior" (minúsculo) e confirmar bloqueio por nome duplicado; desativá-la e confirmar que some das opções de cadastro de candidato mas continua na tela de gestão com o status "inativo". Autenticar como GESTOR e confirmar bloqueio (403) ao tentar acessar a tela/rota.

---

### P2: Vincular Candidato a uma Vaga

**User Story**: Como GESTOR ou RH_ADMIN, quero vincular um candidato a uma `Solicitacao` (Vaga) existente, para relacionar o banco de talentos ao fluxo de aprovação já existente.

**Why P2**: Estende o núcleo (PRD RF7) — vínculo é opcional e a busca nunca depende dele.

**Acceptance Criteria**:

1. WHEN o usuário cadastra ou edita um candidato THEN o system SHALL permitir selecionar uma `Solicitacao` existente para vincular via `solicitacao_id`.
2. WHEN um candidato não está vinculado a nenhuma `Solicitacao` THEN o system SHALL continuar aparecendo normalmente em buscas (o vínculo nunca é pré-requisito).

**Independent Test**: Vincular um candidato já cadastrado a uma Vaga existente e confirmar que ele aparece com o nome da vaga no ranking de busca.

---

### P3: Detalhe do Candidato e Histórico de Buscas

**User Story**: Como GESTOR ou RH_ADMIN, quero ver o currículo completo, a transcrição completa e o histórico de buscas em que o candidato apareceu bem rankeado, para entender melhor o perfil antes de decidir.

**Why P3**: Enriquecimento (PRD RF8) — não bloqueia o valor central do módulo.

**Acceptance Criteria**:

1. WHEN o usuário abre o detalhe de um candidato THEN o system SHALL exibir currículo completo, transcrição completa e histórico de buscas em que apareceu bem rankeado.

---

## Edge Cases

- WHEN a chamada de embedding no cadastro falha THEN o system SHALL manter `Candidato` salvo com `status_embedding = falhou`, fora de buscas até reprocessar, sem bloquear o cadastro (PRD §10).
- WHEN a chamada de justificativa de IA falha para um item do ranking THEN o system SHALL exibir o ranking normalmente, item aparece sem justificativa (PRD §10).
- WHEN a busca ocorre sem nenhum candidato `processado` THEN o system SHALL retornar mensagem clara, não erro (PRD §10).
- WHEN N (quantidade de resultados) é inválido (zero, negativo, não numérico) ou maior que o teto configurável (padrão 100) THEN o system SHALL bloquear a busca com mensagem clara, nunca normalizar silenciosamente.
- WHEN o e-mail submetido no cadastro já existe em outro `Candidato` THEN o system SHALL bloquear a criação com mensagem clara (unicidade de e-mail).
- WHEN o usuário aciona "Reprocessar" em um candidato que não está com `status_embedding = falhou` THEN o system SHALL impedir a ação (ação só disponível para status falhou).
- WHEN a extensão `pgvector` não está disponível no ambiente Postgres THEN o system SHALL falhar de forma explícita na inicialização/migração, não silenciosamente em tempo de busca (risco PRD §12).
- WHEN o nome de uma Tag já existe (case-insensitive) THEN o system SHALL bloquear criação/edição com mensagem clara, nunca criar duplicata silenciosa.
- WHEN um arquivo de currículo enviado não é PDF, `.docx` nem `.md` THEN o system SHALL rejeitar antes de processar, com mensagem clara, sem impedir cadastro via texto colado.
- WHEN a extração de texto de um arquivo válido (PDF/Word/Markdown) falha por corrupção/conteúdo não textual THEN o system SHALL orientar colar o texto manualmente, sem bloquear o cadastro por outros meios.

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreio entre design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| TAL-01 | P1: Cadastrar Candidato | Design | Pending |
| TAL-02 | P1: Cadastrar Candidato (autorização) | Design | Pending |
| TAL-03 | P1: Cadastrar Candidato (embedding não bloqueante) | Design | Pending |
| TAL-04 | P1: Cadastrar Candidato (sucesso) | Design | Pending |
| TAL-05 | P1: Cadastrar Candidato (falha de IA) | Design | Pending |
| TAL-06 | P1: Cadastrar Candidato (validação) | Design | Pending |
| TAL-07 | P1: Cadastrar Candidato (Log AUDITORIA) | Design | Pending |
| TAL-08 | P1: Listar Candidatos | Design | Pending |
| TAL-09 | P1: Listar Candidatos (campos exibidos) | Design | Pending |
| TAL-10 | P1: Listar Candidatos (autorização) | Design | Pending |
| TAL-11 | P1: Listar Candidatos (estado vazio) | Design | Pending |
| TAL-12 | P1: Buscar e Ranquear (embedding da query) | Design | Pending |
| TAL-13 | P1: Buscar e Ranquear (query pgvector) | Design | Pending |
| TAL-14 | P1: Buscar e Ranquear (justificativa IA) | Design | Pending |
| TAL-15 | P1: Buscar e Ranquear (exibição) | Design | Pending |
| TAL-16 | P1: Buscar e Ranquear (nenhum candidato disponível) | Design | Pending |
| TAL-17 | P1: Buscar e Ranquear (falha de justificativa) | Design | Pending |
| TAL-18 | P1: Buscar e Ranquear (autorização) | Design | Pending |
| TAL-19 | P1: Buscar e Ranquear (falha embedding da query) | Design | Pending |
| TAL-20 | P2: Upload PDF (extração) | Design | Pending |
| TAL-21 | P2: Upload PDF (falha de extração) | Design | Pending |
| TAL-22 | P2: Upload PDF (armazenamento) | Design | Pending |
| TAL-23 | P2: Vincular a Vaga | Design | Pending |
| TAL-24 | P2: Vincular a Vaga (opcional) | Design | Pending |
| TAL-25 | P3: Detalhe e histórico de buscas | Design | Pending |
| TAL-26 | Edge: validação de N | Design | Pending |
| TAL-27 | Edge: pgvector indisponível | Design | Pending |
| TAL-28 | P1: Cadastrar Candidato (e-mail duplicado) | Design | Pending |
| TAL-29 | P1: Listar Candidatos (ação Reprocessar) | Design | Pending |
| TAL-30 | P1: Buscar e Ranquear (bloqueio de N inválido) | Design | Pending |
| TAL-31 | P1: Buscar e Ranquear (layout cards + score) | Design | Pending |
| TAL-32 | P1: Cadastrar Candidato (rename parecer técnico) | In Tasks (R1, R3, R7, R9, R12) | Verified (UAT manual) |
| TAL-33 | P1: Classificar com Tags (vínculo many-to-many no cadastro) | In Tasks (R1, R3, R7, R9, R12) | Verified (UAT manual) |
| TAL-34 | P1: Classificar com Tags (badges na listagem) | In Tasks (R7, R13) | Verified (UAT manual) |
| TAL-35 | P1: Classificar com Tags (badges no ranking de busca) | In Tasks (R7, R13) | Verified (UAT manual) |
| TAL-36 | P1: Classificar com Tags (Tag inativa some das opções, mantém vínculo) | In Tasks (R4, R8) | Implementing (coberto por unit tests; não repetido no UAT manual) |
| TAL-37 | P1: Gerenciar Tags (listar) | In Tasks (R4, R8, R10, R11) | Verified (UAT manual) |
| TAL-38 | P1: Gerenciar Tags (criar) | In Tasks (R2, R4, R8, R10) | Verified (UAT manual) |
| TAL-39 | P1: Gerenciar Tags (nome único) | In Tasks (R1, R4, R8, R10) | Verified (UAT manual) |
| TAL-40 | P1: Gerenciar Tags (editar) | In Tasks (R4, R8, R10) | Implementing (coberto por unit tests; UAT manual exercitou ativar/desativar, não editar nome/função) |
| TAL-41 | P1: Gerenciar Tags (ativar/desativar) | In Tasks (R4, R8, R10) | Verified (UAT manual) |
| TAL-42 | P1: Gerenciar Tags (autorização RH_ADMIN-only) | In Tasks (R8, R11) | Verified (UAT manual) |
| TAL-43 | P1: Upload de Currículo (PDF/Word/Markdown, extração + conferência) | In Tasks (R5, R6, R12) | **Bloqueado** — bucket `curriculos` ausente no Supabase real, ver `tasks.md` "UAT manual (achados reais)" |
| TAL-44 | P1: Upload de Currículo (coexistência com texto colado) | In Tasks (R12) | Verified (UAT manual) |
| TAL-45 | P1: Upload de Currículo (falha de extração) | In Tasks (R5, R6) | **Bloqueado** — mesmo motivo de TAL-43 |
| TAL-46 | P1: Upload de Currículo (formato não suportado rejeitado) | In Tasks (R5, R6) | Implementing (coberto por unit tests; não exercitado no UAT manual por causa do bloqueio de TAL-43) |
| TAL-47 | P1: Upload de Currículo (armazenamento Supabase Storage) | In Tasks (R5, R6) | **Bloqueado** — bucket `curriculos` ausente no Supabase real |

**Mapa ID → critério:**

- **TAL-01** — Cadastro cria `Candidato` com `status_embedding = pendente` (P1-Cadastrar #1).
- **TAL-02** — SOLICITANTE bloqueado no backend (P1-Cadastrar #2).
- **TAL-03** — Geração de embedding disparada de forma não bloqueante (P1-Cadastrar #3).
- **TAL-04** — Sucesso atualiza `status_embedding = processado` (P1-Cadastrar #4).
- **TAL-05** — Falha de IA mantém candidato salvo, `status_embedding = falhou`, Log ERRO (P1-Cadastrar #5).
- **TAL-06** — Validação de campos obrigatórios antes de criar (P1-Cadastrar #6).
- **TAL-07** — Log AUDITORIA no cadastro bem-sucedido (P1-Cadastrar #7).
- **TAL-08** — Listagem retorna todos os candidatos, sem filtro por criador (P1-Listar #1).
- **TAL-09** — Lista exibe nome, e-mail, status_embedding (P1-Listar #2).
- **TAL-10** — SOLICITANTE bloqueado no backend (P1-Listar #3).
- **TAL-11** — Estado vazio sem erro (P1-Listar #4).
- **TAL-12** — Embedding da busca gerado a partir do texto livre (P1-Buscar #1).
- **TAL-13** — Query pgvector ordenada por similaridade, filtra `processado` (P1-Buscar #2).
- **TAL-14** — Justificativa de IA gerada para o Top N (P1-Buscar #3).
- **TAL-15** — Exibição de nome, e-mail, vaga, score, justificativa (P1-Buscar #4).
- **TAL-16** — Mensagem clara quando nenhum candidato disponível (P1-Buscar #5).
- **TAL-17** — Falha de justificativa não quebra o ranking (P1-Buscar #6).
- **TAL-18** — SOLICITANTE bloqueado no backend (P1-Buscar #7).
- **TAL-19** — Falha no embedding da query gera Log ERRO e mensagem clara (P1-Buscar #8).
- **TAL-20** — ~~Upload de PDF extrai texto automaticamente~~ **Superseded por TAL-43** (rodada 2 amplia pra PDF/Word/Markdown).
- **TAL-21** — ~~Falha de extração orienta colar texto manualmente~~ **Superseded por TAL-45**.
- **TAL-22** — ~~Armazenamento em Supabase Storage~~ **Superseded por TAL-47**.
- **TAL-23** — Vínculo opcional a `Solicitacao` (P2-Vaga #1).
- **TAL-24** — Ausência de vínculo não afeta busca (P2-Vaga #2).
- **TAL-25** — Detalhe do candidato com histórico de buscas (P3).
- **TAL-26** — Validação/normalização de N inválido (Edge).
- **TAL-27** — Falha explícita se `pgvector` indisponível (Edge, risco PRD §12).
- **TAL-28** — E-mail já existente bloqueia criação (P1-Cadastrar #8; decisão em `context.md`).
- **TAL-29** — Ação "Reprocessar" visível só quando `falhou`, reaciona geração de embedding (P1-Listar #5, #6; decisão em `context.md`).
- **TAL-30** — N inválido ou acima do teto (padrão 100) bloqueia busca com mensagem (P1-Buscar #9; decisão em `context.md`).
- **TAL-31** — Resultados em cards com score em barra visual + percentual (P1-Buscar #10; decisão em `context.md`).
- **TAL-32** — Campo `transcricao_texto` renomeado para `parecer_tecnico`, mesma obrigatoriedade (P1-Cadastrar, revisão; decisão em `context.md`).
- **TAL-33** — Cadastro aceita 0..N Tags ativas, vínculo many-to-many (P1-Tags #1; decisão em `context.md`).
- **TAL-34** — Tags exibidas como badge na listagem de candidatos (P1-Tags #2).
- **TAL-35** — Tags exibidas no card de ranking de busca (P1-Tags #3).
- **TAL-36** — Tag desativada some das opções de novo vínculo, mantém vínculos existentes (P1-Tags #4).
- **TAL-37** — Tela de gestão de Tags lista nome/função/ativo (P1-Gerenciar-Tags #1).
- **TAL-38** — Criação de Tag com `ativo=true` por padrão (P1-Gerenciar-Tags #2).
- **TAL-39** — Nome de Tag único, case-insensitive (P1-Gerenciar-Tags #3).
- **TAL-40** — Edição de nome/função de Tag existente (P1-Gerenciar-Tags #4).
- **TAL-41** — Ativar/desativar Tag sem excluir (P1-Gerenciar-Tags #5).
- **TAL-42** — Gestão de Tags é RH_ADMIN-only, GESTOR/SOLICITANTE bloqueados no backend (P1-Gerenciar-Tags #6; decisão em `context.md`).
- **TAL-43** — Upload de PDF/Word/Markdown extrai texto pra conferência antes de salvar (P1-Upload #1).
- **TAL-44** — Texto colado continua opção, coexiste com upload (P1-Upload #2; decisão em `context.md`).
- **TAL-45** — Falha de extração orienta colar manualmente, não bloqueia cadastro (P1-Upload #3).
- **TAL-46** — Formato não suportado é rejeitado antes de processar (P1-Upload #4).
- **TAL-47** — Arquivo original armazenado em Supabase Storage (bucket `curriculos`) (P1-Upload #5).

**ID format:** `TAL-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 47 total (31 da rodada 1 + 16 novos nesta rodada). TAL-32 a TAL-47 mapeados às tasks R1–R13 (`tasks.md`), implementados e com `npx prisma validate && npm run build`/`npx vitest run` verdes — status `Implementing` até UAT manual confirmar (ver `tasks.md`, seção "Notas da execução real"). TAL-20/21/22 marcados como superseded, não contam mais separadamente.

---

## Success Criteria

Como saberemos que a feature está bem-sucedida (PRD §11):

- [ ] Cadastrar um candidato com texto colado gera embedding com sucesso e ele aparece disponível para busca.
- [ ] Buscar um perfil retorna ranking coerente (candidatos com conteúdo mais próximo do texto buscado aparecem nas primeiras posições) com justificativa de IA para cada um.
- [ ] Alterar o N de resultados muda a quantidade retornada corretamente.
- [ ] Falha simulada de IA (embedding ou justificativa) não impede cadastro nem busca de funcionar, e gera `Log` tipo `ERRO`.
- [ ] Upload de PDF, Word e Markdown extrai texto corretamente para um currículo de teste padrão de cada formato (texto puro, não escaneado/corrompido).
- [ ] RH_Admin cria uma Tag, vincula a um candidato no cadastro, e ela aparece na listagem e no ranking de busca.
- [ ] Desativar uma Tag a remove das opções de novo cadastro sem quebrar candidatos já vinculados a ela.

---

## Questões em Aberto

Zonas cinzentas relevantes para decisão do usuário antes de avançar para Design:

1. **Mecanismo de "background" para geração de embedding.** O PRD diz "gerado em background" mas não define o mecanismo. Stack atual (Next.js API routes) não tem worker/fila dedicada — a opção mais simples é gerar de forma síncrona dentro da própria request de `POST /api/candidatos` (aceitando latência extra), mas isso não é tecnicamente "background". Alternativa é fire-and-forget dentro da mesma request (sem esperar) ou fila real (ex: tabela de jobs + cron). Decisão afeta `candidatoService`/`embeddingService`. **A ser decidido no Design.**
2. ✅ **RESOLVIDO** (ver `context.md`) — **Reprocessamento de embedding com `status_embedding = falhou`**: botão "Reprocessar" por linha na lista de candidatos, visível só quando falhou.
3. ✅ **RESOLVIDO** (ver `context.md`) — **Duplicidade de e-mail entre candidatos**: cadastro bloqueia se e-mail já existe na base.
4. **Edição/exclusão de candidato após cadastro.** PRD não descreve. Assumido fora de escopo nesta spec (mesma decisão adotada em `solicitacoes` para o padrão do projeto).
5. ✅ **RESOLVIDO** (ver `context.md`) — **Limites de N (quantidade de resultados)**: N inválido ou acima do teto bloqueia a busca com mensagem clara; teto configurável, valor inicial 100.
6. **Mecanismo de "background" para geração de embedding** (item 1 acima) permanece técnico, não de UX — endereçado no Design, não no Discuss.
7. ✅ **RESOLVIDO** (ver `context.md`, rodada 2) — **Parecer técnico obrigatório ou opcional**: mantido obrigatório, mesma regra da transcrição.
8. ✅ **RESOLVIDO** (ver `context.md`, rodada 2) — **Significado do campo "função" da Tag**: descrição livre, sem estrutura de categoria.
9. ✅ **RESOLVIDO** (ver `context.md`, rodada 2) — **Cardinalidade Candidato↔Tag**: many-to-many (múltiplas tags por candidato).
10. ✅ **RESOLVIDO** (ver `context.md`, rodada 2) — **Coexistência upload vs texto colado**: ambos coexistem.
11. ✅ **RESOLVIDO** (ver `context.md`, rodada 2) — **Quem gerencia Tags**: só RH_ADMIN.

---

## Changelog

### Rodada 2 (2026-08-03)

- Campo `transcricao_texto` renomeado para `parecer_tecnico` (TAL-32) — mesmo papel funcional, mudança de nome/semântica apenas.
- Nova entidade `Tag` (nome, função, ativo) + vínculo many-to-many com `Candidato` (TAL-33 a TAL-36).
- Nova tela de gestão de Tags, RH_ADMIN-only (TAL-37 a TAL-42).
- Upload de currículo promovido de P2 pra este ciclo, formatos ampliados de "só PDF" pra PDF/Word/Markdown (TAL-43 a TAL-47, supersede TAL-20/21/22).
- Importação de planilhas documentada como fora de escopo desta rodada — nenhum requisito TAL criado, apenas nota de compatibilidade futura na tabela de Out of Scope.
