# Banco de Talentos Specification

> Feature `banco-de-talentos` (prefixo `TAL`) — módulo novo de triagem de currículos com IA.
> Fonte da verdade: `docs/prd/2026-07-30-banco-de-talentos-prd.md`, `docs/2026-07-30-fluxorh-design.md` e `CLAUDE.md` (regras invioláveis).

## Problem Statement

Cruzar currículo e transcrição de entrevista pra avaliar candidato é hoje manual: alguém relê os dois textos e decide "na cabeça" se atende à vaga. É lento e inconsistente entre avaliadores. Este módulo permite RH/Gestor descrever o perfil desejado em texto livre e receber, em segundos, ranking objetivo de candidatos já cadastrados, com justificativa gerada por IA.

## Goals

- [ ] RH/Gestor cadastra candidato (nome, e-mail, telefone, currículo colado, transcrição colada) e o embedding é gerado automaticamente, sem bloquear o cadastro em caso de falha de IA.
- [ ] RH/Gestor busca por perfil em texto livre e recebe ranking Top N (customizável) ordenado por similaridade, com justificativa textual por candidato.
- [ ] Falha de IA (embedding ou justificativa) nunca impede cadastro nem busca — segue padrão de resiliência já adotado no RHOP.

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Reason |
| --- | --- |
| Integração automática com Google Meet/Workspace para captura de transcrição | PRD §6 — transcrição sempre colada manualmente, já gerada externamente. |
| Múltiplos currículos ou múltiplas transcrições por candidato | PRD §6 — um de cada por candidato nesta versão. |
| Reprocessamento em lote de embeddings antigos se o modelo mudar | PRD §6 — fora de escopo. |
| Decisão automática de aprovação/reprovação de candidato | PRD §6 — módulo só ranqueia e explica; decisão final é humana. |
| Upload de PDF com extração de texto | RF6, P1 (estende o núcleo) — não faz parte do MVP (P0). |
| Vincular candidato a uma `Solicitacao` existente | RF7, P1 (estende o núcleo) — não faz parte do MVP (P0). |
| Tela de detalhe do candidato + histórico de buscas | RF8, P2 (enriquecimento) — corta primeiro se necessário. |
| Distinção "próprios vs equipe" na visibilidade | PRD §4 — GESTOR e RH_ADMIN veem a base inteira; não há filtro por criador. |
| Edição ou exclusão de candidato após cadastro | Não descrito no PRD. Ver Questões em Aberto. |

---

## User Stories

### P1: Cadastrar Candidato ⭐ MVP

**User Story**: Como GESTOR ou RH_ADMIN, quero cadastrar um candidato com nome, e-mail, telefone, currículo e transcrição colados, para que ele entre na base disponível para busca.

**Why P1**: É o ponto de entrada de dados do módulo — sem candidato cadastrado não há o que buscar/ranquear (PRD RF1, RF2).

**Acceptance Criteria**:

1. WHEN um usuário com papel GESTOR ou RH_ADMIN submete o formulário de cadastro com nome, e-mail, telefone, texto de currículo e texto de transcrição THEN o system SHALL criar um `Candidato` com `status_embedding = pendente` e `criado_por` = usuário autenticado.
2. WHEN um usuário com papel SOLICITANTE tenta acessar o cadastro de candidato THEN o system SHALL negar o acesso no backend.
3. WHEN o `Candidato` é criado THEN o system SHALL disparar, de forma não bloqueante, a geração do embedding a partir de `curriculo_texto` + `transcricao_texto` combinados.
4. WHEN a geração do embedding é bem-sucedida THEN o system SHALL atualizar `status_embedding` para `processado`.
5. WHEN a geração do embedding falha (timeout, erro, rate limit) THEN o system SHALL manter o `Candidato` salvo e visível, atualizar `status_embedding` para `falhou` e gravar `Log` tipo `ERRO` — a falha NUNCA impede o cadastro.
6. WHEN campos obrigatórios (nome, e-mail, telefone, currículo, transcrição) estão ausentes THEN o system SHALL rejeitar a submissão com mensagem clara e NÃO criar o `Candidato`.
7. WHEN o `Candidato` é criado com sucesso THEN o system SHALL gravar um `Log` tipo `AUDITORIA`.
8. WHEN o e-mail submetido já pertence a um `Candidato` existente THEN o system SHALL bloquear a criação com mensagem clara e NÃO criar um segundo `Candidato` com o mesmo e-mail.

**Independent Test**: Autenticar como GESTOR, cadastrar um candidato com texto colado válido, confirmar que aparece na lista com `status_embedding = pendente` e, após processamento, `processado`.

---

### P1: Listar Candidatos ⭐ MVP

**User Story**: Como GESTOR ou RH_ADMIN, quero ver todos os candidatos cadastrados com o status do embedding de cada um, para saber quem já está disponível para busca.

**Why P1**: É a tela que fecha o loop de confiança do cadastro — sem ela não dá pra verificar se o embedding processou (PRD RF5).

**Acceptance Criteria**:

1. WHEN um usuário GESTOR ou RH_ADMIN abre a lista de candidatos THEN o system SHALL retornar todos os candidatos cadastrados (sem filtro por `criado_por` — visibilidade colaborativa, PRD §4).
2. WHEN a lista é exibida THEN o system SHALL mostrar, para cada candidato, ao menos nome, e-mail e `status_embedding` (pendente/processado/falhou).
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
4. WHEN a tela exibe o ranking THEN o system SHALL mostrar nome, e-mail, vaga vinculada (se houver), score de similaridade e justificativa de cada candidato.
5. WHEN não existe nenhum candidato com `status_embedding = processado` THEN o system SHALL exibir mensagem clara ("nenhum candidato disponível para busca ainda"), nunca erro não tratado.
6. WHEN a geração de justificativa de IA falha para um candidato específico THEN o system SHALL exibir esse candidato no ranking sem justificativa, sem quebrar o ranking dos demais.
7. WHEN um usuário SOLICITANTE tenta acessar a busca THEN o system SHALL negar o acesso no backend.
8. WHEN falha a geração do embedding da própria busca THEN o system SHALL gravar `Log` tipo `ERRO` e retornar mensagem clara ao usuário (busca não pode ser concluída sem embedding da query).
9. WHEN N é zero, negativo, não numérico, ou maior que o teto máximo configurável (padrão 100) THEN o system SHALL bloquear a busca com mensagem clara, sem executar a query.
10. WHEN os resultados são exibidos THEN o system SHALL apresentar cada candidato em um card com score de similaridade representado por barra visual + percentual.

**Independent Test**: Com ao menos 3 candidatos processados de perfis distintos, buscar um perfil específico e confirmar que o candidato mais aderente aparece em 1º lugar com justificativa coerente, e que mudar N muda a quantidade retornada.

---

### P2: Upload de Currículo em PDF

**User Story**: Como GESTOR ou RH_ADMIN, quero subir o currículo em PDF em vez de colar o texto manualmente, para agilizar o cadastro.

**Why P2**: Estende o núcleo (PRD RF6) — o cadastro já funciona via texto colado no P1; isso é conveniência.

**Acceptance Criteria**:

1. WHEN o usuário sobe um arquivo PDF de currículo THEN o system SHALL extrair o texto automaticamente e exibi-lo para conferência antes de salvar.
2. WHEN a extração de texto falha (ex: PDF escaneado/imagem) THEN o system SHALL exibir erro claro e orientar o usuário a colar o texto manualmente, sem bloquear o cadastro por outros meios.
3. WHEN o PDF é processado com sucesso THEN o system SHALL armazenar o arquivo em Supabase Storage (bucket `curriculos`) e salvar a URL em `curriculo_arquivo_url`.

**Independent Test**: Subir um PDF de texto puro (não escaneado) e confirmar que o texto extraído bate com o conteúdo do arquivo antes de salvar.

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
- **TAL-20** — Upload de PDF extrai texto automaticamente (P2-PDF #1).
- **TAL-21** — Falha de extração orienta colar texto manualmente (P2-PDF #2).
- **TAL-22** — Armazenamento em Supabase Storage (P2-PDF #3).
- **TAL-23** — Vínculo opcional a `Solicitacao` (P2-Vaga #1).
- **TAL-24** — Ausência de vínculo não afeta busca (P2-Vaga #2).
- **TAL-25** — Detalhe do candidato com histórico de buscas (P3).
- **TAL-26** — Validação/normalização de N inválido (Edge).
- **TAL-27** — Falha explícita se `pgvector` indisponível (Edge, risco PRD §12).
- **TAL-28** — E-mail já existente bloqueia criação (P1-Cadastrar #8; decisão em `context.md`).
- **TAL-29** — Ação "Reprocessar" visível só quando `falhou`, reaciona geração de embedding (P1-Listar #5, #6; decisão em `context.md`).
- **TAL-30** — N inválido ou acima do teto (padrão 100) bloqueia busca com mensagem (P1-Buscar #9; decisão em `context.md`).
- **TAL-31** — Resultados em cards com score em barra visual + percentual (P1-Buscar #10; decisão em `context.md`).

**ID format:** `TAL-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 31 total, 0 mapeados a tasks, 31 não mapeados ⚠️ (esperado nesta fase Specify).

---

## Success Criteria

Como saberemos que a feature está bem-sucedida (PRD §11):

- [ ] Cadastrar um candidato com texto colado gera embedding com sucesso e ele aparece disponível para busca.
- [ ] Buscar um perfil retorna ranking coerente (candidatos com conteúdo mais próximo do texto buscado aparecem nas primeiras posições) com justificativa de IA para cada um.
- [ ] Alterar o N de resultados muda a quantidade retornada corretamente.
- [ ] Falha simulada de IA (embedding ou justificativa) não impede cadastro nem busca de funcionar, e gera `Log` tipo `ERRO`.
- [ ] (P2) Upload de PDF extrai texto corretamente para um currículo de teste padrão (texto puro, não escaneado).

---

## Questões em Aberto

Zonas cinzentas relevantes para decisão do usuário antes de avançar para Design:

1. **Mecanismo de "background" para geração de embedding.** O PRD diz "gerado em background" mas não define o mecanismo. Stack atual (Next.js API routes) não tem worker/fila dedicada — a opção mais simples é gerar de forma síncrona dentro da própria request de `POST /api/candidatos` (aceitando latência extra), mas isso não é tecnicamente "background". Alternativa é fire-and-forget dentro da mesma request (sem esperar) ou fila real (ex: tabela de jobs + cron). Decisão afeta `candidatoService`/`embeddingService`. **A ser decidido no Design.**
2. ✅ **RESOLVIDO** (ver `context.md`) — **Reprocessamento de embedding com `status_embedding = falhou`**: botão "Reprocessar" por linha na lista de candidatos, visível só quando falhou.
3. ✅ **RESOLVIDO** (ver `context.md`) — **Duplicidade de e-mail entre candidatos**: cadastro bloqueia se e-mail já existe na base.
4. **Edição/exclusão de candidato após cadastro.** PRD não descreve. Assumido fora de escopo nesta spec (mesma decisão adotada em `solicitacoes` para o padrão do projeto).
5. ✅ **RESOLVIDO** (ver `context.md`) — **Limites de N (quantidade de resultados)**: N inválido ou acima do teto bloqueia a busca com mensagem clara; teto configurável, valor inicial 100.
6. **Mecanismo de "background" para geração de embedding** (item 1 acima) permanece técnico, não de UX — endereçado no Design, não no Discuss.
