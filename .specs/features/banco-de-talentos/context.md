# Banco de Talentos Context

**Gathered:** 2026-07-31
**Spec:** `.specs/features/banco-de-talentos/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Módulo de triagem de currículos com IA: cadastro de candidato (texto colado de currículo + transcrição), listagem com status de embedding, e busca/ranking em texto livre com justificativa gerada por IA. Upload de PDF, vínculo a `Solicitacao` e tela de detalhe/histórico ficam fora deste ciclo (P2/P3, ver spec.md).

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
