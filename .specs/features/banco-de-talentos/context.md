# Banco de Talentos Context

**Gathered:** 2026-07-31 (rodada 1) + 2026-08-03 (rodada 2) + 2026-08-04 (rodada 3)
**Spec:** `.specs/features/banco-de-talentos/spec.md`
**Status:** Ready for design (rodada 3)

---

## Feature Boundary

Módulo de triagem de currículos com IA: cadastro de candidato (currículo colado ou enviado como arquivo + parecer técnico), classificação por Tags, listagem com status de embedding e Tags, busca/ranking em texto livre com justificativa gerada por IA, e tela de detalhe do candidato com resumo de IA persistido. Vínculo a `Solicitacao`, histórico de buscas no detalhe e importação de planilhas ficam fora deste ciclo (ver spec.md).

---

## Rodada 3 — Implementation Decisions (2026-08-04)

### Origem do "resumo de IA salvo previamente"

- Não existia campo persistido de resumo por candidato — só a `justificativa` gerada em tempo real durante uma busca (efêmera, ligada a um texto de busca específico, nunca salva).
- Decisão: criar `Candidato.resumo_ia`, gerado de forma **não bloqueante junto do embedding** (mesma chamada de processamento, no cadastro e no reprocessamento), seguindo o padrão já usado em `Solicitacao.resumo_ia`/`Aprovacao.resumo_ia`. Falha nunca bloqueia cadastro/embedding/reprocessamento — grava `Log ERRO` e mantém `resumo_ia = null`.
- Alternativa descartada: reaproveitar a última `justificativa` de busca (exigiria persistir histórico de busca, que não existe e está fora de escopo).

### Escopo da tela de detalhe

- Entra nesta rodada: navegação por clique na listagem, dados completos (nome, e-mail, telefone, status_embedding, Tags, vaga vinculada, currículo completo, parecer técnico completo) e o `resumo_ia` em destaque (estilo `.callout-ia`) quando existir.
- Fica fora: histórico de buscas em que o candidato apareceu bem rankeado (P3, `TAL-25`, sem mudança nesta rodada).

### Candidatos antigos sem `resumo_ia`

- Candidatos cadastrados antes desta funcionalidade ficam com `resumo_ia = null` permanentemente, a menos que passem por "Reprocessar" (só visível quando `status_embedding = falhou`).
- Tela de detalhe trata isso com o mesmo fallback gracioso de uma falha de IA — nunca erro, nunca bloqueia a tela.
- Se vale a pena um botão de "Gerar resumo" independente do reprocessamento de embedding fica **a decidir no Design** (ver Questão em Aberto #13 na spec).

### Agent's Discretion (rodada 3)

- Layout exato da tela de detalhe (ordem dos campos, onde o `.callout-ia` aparece em relação aos dados brutos) — seguir `docs/design-ux-ui/fluxorh-ui-layout-specs.md` e `docs/design-ux-ui/fluxorh-mockup.html` como referência visual.
- Se a rota de detalhe é Server Component com fetch direto via `candidatoService` (mesmo padrão da listagem, sem round-trip por API) ou precisa de uma rota `GET /api/candidatos/[id]` dedicada — Design decide.
- Prompt exato usado para gerar `resumo_ia` (tom, tamanho) — Design/implementação decide, seguindo o padrão já usado em `iaService.ts`.

---

## Rodada 2 — Implementation Decisions (2026-08-03)

### Parecer técnico (substitui transcrição)

- Continua **obrigatório** no cadastro — mesma regra que a transcrição tinha antes. Não vira opcional, não ganha edição posterior.
- É rename de campo/semântica (`transcricao_texto` → `parecer_tecnico`), não um campo novo — mesmo papel na geração do embedding (combinado com `curriculo_texto`).

### Tag — campo "função"

- Representa **descrição livre** do que a tag significa/serve — não é uma categoria estruturada (não existe "tipo de tag" nem hierarquia).
- Catálogo de Tag é plano: `nome` (único), `funcao` (texto livre), `ativo` (boolean).

### Cardinalidade Candidato↔Tag

- **Many-to-many**: um candidato pode acumular várias Tags (ex: "Backend" + "Sênior" + "Urgente" ao mesmo tempo).

### Upload de currículo (PDF/Word/Markdown)

- **Coexiste** com o texto colado — usuário escolhe subir arquivo OU colar texto, nunca é obrigado a um dos dois especificamente.
- Texto extraído do arquivo é exibido pra conferência antes de salvar (mesmo desenho já previsto no P2 original da spec, agora com 3 formatos em vez de só PDF).
- Falha de extração (qualquer formato) nunca bloqueia o cadastro — orienta colar manualmente.

### Gestão de Tags

- Só **RH_ADMIN** cria/edita/ativa/desativa Tags — mesmo padrão de Equipes e Tipos de Fluxo (configuração é RH_ADMIN-only).
- GESTOR usa as Tags já existentes (ativas) ao classificar candidato, mas não acessa a tela/rotas de gestão.

### Agent's Discretion (rodada 2)

- Layout exato da tela de gestão de Tags (lista + form) — segue o padrão visual já usado em `configuracao-fluxos`.
- Como o multi-select de Tags aparece no formulário de cadastro de candidato (checkboxes, chips, etc.) — Design/implementação decide, desde que envie `tag_ids: string[]`.
- Limite de tamanho de arquivo de currículo e mensagens de erro específicas por formato — Design decide um teto razoável (ex: 5MB), desde que documentado e configurável.

---

## Deferred Ideas (rodada 2)

- **Importação de planilhas de candidatos com planilha modelo** — pedido explicitamente para ficar fora desta rodada, "só para coincidir depois". Nomes de campo (`Candidato`, `Tag`) foram mantidos simples e planos nesta revisão para reduzir remapeamento futuro, mas nenhuma tela/rota de import é criada agora.

---

## Implementation Decisions

### E-mail duplicado

- Cadastro de candidato **bloqueia** se já existe candidato com o mesmo e-mail na base — unicidade de e-mail é regra de negócio, não apenas aviso.
- Normalização da comparação (case-insensitive, trim) fica a critério do Design/implementação.

### Reprocessar embedding falho

- Tela de Listar Candidatos ganha um botão **"Reprocessar"** por linha, visível apenas quando `status_embedding = falhou`.
- Aciona regeração do embedding sob demanda para aquele candidato específico.
- Detalhes de UI (loading state durante reprocessamento, feedback de sucesso/erro) ficam a critério do Design/implementação.

### Layout da tela de busca/ranking

- Resultados exibidos como **cards** (um por candidato) — nome, e-mail, score, justificativa, vaga vinculada (se houver).
- Score de similaridade exibido como **barra visual + percentual** (ex: barra de progresso colorida ao lado de "87%"), reforçando comparação rápida entre candidatos.

### Validação de N (quantidade de resultados)

- N inválido (zero, negativo, não numérico, ou maior que o teto) **bloqueia a busca com mensagem clara** — não normaliza silenciosamente.
- Existe um teto máximo de N, mas ele é **configurável** (não hardcoded no código) — valor inicial de **100**. Design deve prever onde esse valor mora (config/env) para ser ajustável sem alterar código.

### Agent's Discretion

- Normalização exata da comparação de e-mail (case, trim, whitespace interno).
- Estados de loading/feedback visual do botão "Reprocessar".
- Onde exatamente o teto de N configurável é armazenado (env var, tabela de config, constante ajustável) — Design decide o mecanismo, mas não pode ser um número fixo no código sem ponto de ajuste.

---

## Specific References

Nenhuma referência de produto externo citada durante a discussão — decisões seguem os padrões visuais já em uso no restante do RHOP (cards, badges de status).

---

## Deferred Ideas

None — discussão ficou dentro do escopo da feature. Os itens de mecanismo de "background" do embedding e disponibilidade de `pgvector` continuam como questões técnicas em aberto na spec, endereçadas no Design (não são gray areas de UX).
