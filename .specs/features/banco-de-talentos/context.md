# Banco de Talentos Context

**Gathered:** 2026-07-31 (rodada 1) + 2026-08-03 (rodada 2)
**Spec:** `.specs/features/banco-de-talentos/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Módulo de triagem de currículos com IA: cadastro de candidato (currículo colado ou enviado como arquivo + parecer técnico), classificação por Tags, listagem com status de embedding e Tags, e busca/ranking em texto livre com justificativa gerada por IA. Vínculo a `Solicitacao`, tela de detalhe/histórico e importação de planilhas ficam fora deste ciclo (ver spec.md).

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
