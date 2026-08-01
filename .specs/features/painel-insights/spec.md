# Painel de Insights Specification

> Feature slug: `painel-insights` — Requirement ID prefix: `INSIGHT`
> Tela 6 do design doc (`docs/2026-07-30-fluxorh-design.md`). Segunda feature de IA destacada no pitch (seção 11).

## Problem Statement

O RH não tem uma visão agregada e legível dos padrões escondidos nas solicitações (ex.: em quais áreas as vagas se concentram, como o reembolso está evoluindo no tempo). Os dados existem nas `Solicitacao`, mas ler linha a linha não revela tendências. Precisamos transformar esses dados reais da empresa em um gráfico quantitativo somado a uma explicação em linguagem natural gerada por IA, reforçando a narrativa de "IA generativa aplicada a dados reais".

## Goals

- [ ] Permitir que o usuário autorizado filtre por **tipo de fluxo** e **período** e veja um **gráfico quantitativo** (Recharts) das `Solicitacao` correspondentes.
- [ ] Gerar um **resumo em linguagem natural por IA** que explique o padrão principal — a partir **exclusivamente** dos números já agregados no backend, nunca dos dados brutos.
- [ ] Garantir que a agregação aconteça **100% em queries de Postgres (sem IA)** e que a IA seja invocada só para narrar o resultado.
- [ ] Garantir que qualquer falha da OpenAI **não trave** o painel: o gráfico continua visível e o erro é registrado em `Log` tipo `ERRO`.

## Out of Scope

Explicitamente excluído. Documentado para prevenir scope creep.

| Feature | Motivo |
| --- | --- |
| Contadores operacionais (pendentes / atrasados / aprovados / rejeitados) | Pertence a `dashboard-visao-geral` (DASH). |
| Geração de `resumo_ia` por solicitação individual | Pertence a `aprovacoes` (APR) — é a hero feature de IA por solicitação, não o insight agregado. |
| Lista filtrável de solicitações individuais | Pertence a `dashboard-visao-geral` (DASH). Aqui só há agregados. |
| A IA fazer a agregação / consultar o banco | Regra do design doc (seção 7): agregação é feita em Postgres; a IA só recebe o payload numérico compacto e narra. |
| Export (CSV/PDF) do gráfico ou do resumo | Não previsto no design doc; YAGNI para o MVP. |
| Configuração de novos tipos de gráfico pelo usuário | Fora do escopo do MVP; ver Questões em Aberto sobre dimensão de agregação. |
| Cadastro/edição de `TipoFluxo` usado no filtro | Pertence a `configuracao-fluxos` (CONF); aqui só é consumido para popular o filtro. |

---

## User Stories

### P1: Visualizar gráfico quantitativo agregado por tipo e período ⭐ MVP

**User Story**: Como RH_ADMIN, quero filtrar as solicitações por tipo de fluxo e período e ver um gráfico com a distribuição quantitativa, para enxergar padrões (ex.: concentração de vagas por área) sem ler cada solicitação.

**Why P1**: É a base do painel — sem a agregação e o gráfico não há o que a IA narrar. É a metade visual da feature de pitch.

**Acceptance Criteria**:

1. WHEN o usuário autorizado abre o Painel de Insights THEN o sistema SHALL exibir um seletor de **tipo de fluxo** (populado a partir dos `TipoFluxo` existentes) e um seletor de **período**.
2. WHEN o usuário seleciona um tipo de fluxo e um período e confirma THEN o sistema SHALL agregar as `Solicitacao` daquele tipo criadas dentro do período usando **queries de agregação no Postgres**, sem qualquer chamada de IA nessa etapa.
3. WHEN a agregação retorna THEN o sistema SHALL renderizar um **gráfico Recharts** representando a distribuição quantitativa (ex.: contagem por categoria/área) e SHALL montar um **payload numérico compacto** com os mesmos números.
4. WHEN a requisição chega a uma API route THEN a route SHALL validar entrada com Zod, checar autenticação/autorização e delegar ao `insightsService`, SEM lógica de agregação ou acesso direto ao Prisma na própria route.
5. WHEN o período selecionado não possui nenhuma `Solicitacao` do tipo escolhido THEN o sistema SHALL exibir um estado vazio claro ("sem dados no período") e SHALL NOT chamar a OpenAI.
6. WHEN o backend nega acesso (papel não autorizado) THEN o sistema SHALL bloquear a resposta no backend com erro de autorização, não apenas escondendo a tela.

**Independent Test**: Autenticado como RH_ADMIN, selecionar "Vaga" e um período com dados → ver o gráfico com a contagem correta; selecionar um período vazio → ver o estado vazio sem que nenhuma chamada de IA seja disparada.

---

### P1: Resumo em linguagem natural gerado por IA a partir dos números agregados ⭐ MVP

**User Story**: Como RH_ADMIN, quero, junto ao gráfico, um parágrafo em linguagem natural gerado por IA explicando o padrão principal, para entender rapidamente o que os números significam.

**Why P1**: É a segunda feature de IA destacada no pitch (seção 11 do design doc) — o valor central do painel.

**Acceptance Criteria**:

1. WHEN a agregação produz o payload numérico compacto THEN o sistema SHALL chamar a OpenAI (`gpt-4o-mini`) **somente no backend** (via `iaService`), passando **apenas os números agregados** — nunca as linhas brutas de `Solicitacao`.
2. WHEN a OpenAI responde com sucesso THEN o sistema SHALL exibir o texto retornado como resumo do padrão principal, ao lado/abaixo do gráfico.
3. WHEN a chamada à OpenAI falha (timeout, erro, rate limit) THEN o sistema SHALL manter o gráfico visível, exibir o painel sem o resumo (com aviso de que o resumo não pôde ser gerado) e SHALL registrar um `Log` tipo `ERRO` — a falha de IA nunca trava o painel.
4. WHEN o resumo é gerado THEN o texto SHALL ser derivado exclusivamente dos números do payload, sem que a IA execute agregação ou acesse o banco.

**Independent Test**: Com dados no período, confirmar o filtro → ver o gráfico e um parágrafo coerente com os números; forçar falha da OpenAI (chave inválida/mock de erro) → ver o gráfico permanecer, o aviso de resumo indisponível e um registro `Log` tipo `ERRO`.

---

### P2: Escopo de visibilidade por papel na agregação

**User Story**: Como Gestor (se autorizado a acessar o painel), quero que os insights reflitam apenas as solicitações que eu posso ver (minha equipe), para não expor dados de outras equipes.

**Why P2**: A regra de visibilidade do CLAUDE.md é inviolável para toda query de listagem/agregação, mas o acesso do Gestor ao painel depende de decisão em aberto (ver Questões em Aberto). O caminho seguro de MVP é RH_ADMIN vendo tudo; o escopo por equipe entra quando o acesso do Gestor for confirmado.

**Acceptance Criteria**:

1. WHEN o usuário autenticado é RH_ADMIN THEN a agregação SHALL considerar todas as `Solicitacao` do tipo/período (visão global).
2. WHEN o usuário autenticado é GESTOR e o acesso ao painel lhe for concedido THEN a agregação SHALL considerar somente as `Solicitacao` visíveis a ele (as próprias + as de usuários cujo `gestor_id` aponta para ele), aplicando o filtro de visibilidade **na própria query de agregação**.
3. WHEN um usuário sem permissão de acesso ao painel tenta acessar o endpoint THEN o sistema SHALL retornar erro de autorização no backend.

**Independent Test**: Com o acesso de Gestor habilitado, autenticar como Gestor da equipe A → os números agregados batem apenas com as solicitações da equipe A, ignorando a equipe B.

---

### P3: Escolher a dimensão de agregação do gráfico

**User Story**: Como RH_ADMIN, quero poder escolher por qual dimensão o gráfico agrega (ex.: por área, por status, por mês), para explorar diferentes padrões do mesmo tipo de fluxo.

**Why P3**: O design doc cita exemplos distintos ("concentração de vagas por área", "tendências de reembolso") que implicam dimensões diferentes, mas o MVP pode entregar uma dimensão padrão por tipo. Depende da decisão sobre como mapear campos dinâmicos de `dados` (ver Questões em Aberto).

**Acceptance Criteria**:

1. WHEN mais de uma dimensão de agregação está disponível para o tipo selecionado THEN o sistema SHALL permitir ao usuário escolher a dimensão e SHALL re-agregar (Postgres) e re-narrar (IA) com base nela.

---

## Edge Cases

- WHEN o período selecionado não tem solicitações THEN o sistema SHALL exibir estado vazio e SHALL NOT chamar a OpenAI (economia de custo/latência).
- WHEN a OpenAI falha ou excede timeout THEN o sistema SHALL manter o gráfico, ocultar o resumo com aviso e gravar `Log` tipo `ERRO`.
- WHEN o intervalo de período é inválido (data final antes da inicial, ou fora de formato) THEN a route SHALL rejeitar via validação Zod com erro claro, antes de qualquer query.
- WHEN o `TipoFluxo` selecionado não existe (id inválido) THEN o sistema SHALL retornar erro de validação e não agregar.
- WHEN o payload agregado tem volume muito pequeno (ex.: 1–2 solicitações) THEN o resumo por IA SHALL ainda ser válido, evitando afirmar tendências não sustentadas pelos números (o prompt deve refletir a baixa amostragem).
- WHEN um GESTOR autorizado consulta mas não gerencia ninguém (sem subordinados) THEN a agregação SHALL considerar apenas as próprias solicitações e SHALL exibir estado vazio se não houver nenhuma no período.

---

## Requirement Traceability

Cada requisito recebe um ID único para rastreio entre design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| INSIGHT-01 | P1: Gráfico agregado — filtro tipo + período | Tasks (T1, T6) | In Tasks |
| INSIGHT-02 | P1: Gráfico agregado — agregação em Postgres (sem IA) + payload numérico compacto | Tasks (T4) | In Tasks |
| INSIGHT-03 | P1: Gráfico agregado — renderização Recharts | Tasks (T2, T6) | In Tasks |
| INSIGHT-04 | P1: Gráfico agregado — route valida (Zod) + delega a `insightsService`, sem Prisma na route | Tasks (T1, T5) | In Tasks |
| INSIGHT-05 | P1: Gráfico agregado — estado vazio sem chamar IA | Tasks (T4, T6) | In Tasks |
| INSIGHT-06 | P1: Resumo IA — chamada `gpt-4o-mini` server-side só com números agregados | Tasks (T3, T4) | In Tasks |
| INSIGHT-07 | P1: Resumo IA — exibição do resumo junto ao gráfico | Tasks (T6) | In Tasks |
| INSIGHT-08 | P1: Resumo IA — falha da OpenAI não trava; gráfico permanece; `Log` tipo `ERRO` | Tasks (T3, T4, T6) | In Tasks |
| INSIGHT-09 | P2: Visibilidade — RH_ADMIN vê tudo; GESTOR (se autorizado) só a equipe, filtrado na query de agregação | Tasks (T4) | In Tasks |
| INSIGHT-10 | P1/P2: Autorização de acesso ao painel bloqueada no backend | Tasks (T5) | In Tasks |
| INSIGHT-11 | P3: Seleção da dimensão de agregação (re-agrega + re-narra) | Tasks (T1, T4, T6) | In Tasks |

**ID format:** `[CATEGORY]-[NUMBER]` (ex.: `INSIGHT-01`).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 11 total, 11 mapeados a tasks, 0 não mapeados. Ver `design.md` (Requirement Mapping) e `tasks.md` (Traceability).

---

## Success Criteria

Como saberemos que a feature está bem-sucedida:

- [ ] Usuário autorizado consegue escolher tipo + período e ver o gráfico quantitativo correto em poucos segundos.
- [ ] Toda agregação numérica vem de queries Postgres; nenhuma chamada de IA participa do cálculo dos números.
- [ ] O resumo por IA é gerado a partir apenas do payload numérico e é coerente com o gráfico exibido.
- [ ] Falha simulada da OpenAI mantém o painel funcional (gráfico visível) e produz exatamente um `Log` tipo `ERRO`.
- [ ] A visibilidade por papel é respeitada na agregação (RH_ADMIN global; GESTOR restrito à equipe, se o acesso for concedido).
- [ ] `npm run build` e `npx prisma validate` passam.

---

## Questões em Aberto

1. ✅ **RESOLVIDO** (ver `context.md`) — **Papel de acesso ao painel**: RH_ADMIN vê tudo; GESTOR também tem acesso, restrito à própria equipe. INSIGHT-09 passa a ser obrigatório no MVP (deixa de ser condicional).
2. **Dimensão de agregação sobre `dados` (JSON dinâmico).** Como o painel decide por qual campo agregar, já que `campos_formulario`/`dados` variam por `TipoFluxo`? Opções: (a) dimensões genéricas independentes de tipo (por status e por mês de `criado_em`); (b) campo(s) de agregação configurável(is) por `TipoFluxo` (ex.: marcar "área" como agregável); (c) heurística sobre os campos do formulário. O exemplo "vagas por área" implica agregar um campo de `dados`, o que exige uma dessas decisões.
3. **Definição de "período".** Faixas predefinidas (últimos 30/90 dias, ano atual) ou seletor de datas customizado (início/fim)? Impacta a UI do filtro e a validação Zod.
4. **Cache/custo do resumo de IA.** Gerar o texto a cada requisição ou cachear por combinação tipo+período+dimensão para reduzir custo/latência da OpenAI? Não previsto explicitamente no design doc; sinalizado por afetar custo na demo.
5. **Formato do gráfico por tipo.** Barras (contagem por categoria, ex.: vagas por área) vs. linha/tempo (tendências de reembolso). Pode ser derivado da dimensão (Questão 2) ou fixado por tipo de fluxo — confirmar expectativa visual do pitch.
