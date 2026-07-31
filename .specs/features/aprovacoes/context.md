# Aprovações — Context (decisões de zonas cinzentas)

**Spec**: `.specs/features/aprovacoes/spec.md`
**Status**: Resolved for Design/Execute

---

## Questões do spec.md (resolvidas)

| # | Questão | Decisão |
| --- | --- | --- |
| 1 | Reprocessar `resumo_ia` manualmente? | **Não** no MVP. Card mostra "resumo indisponível"; sem botão de regenerar. |
| 2 | Comentário obrigatório na rejeição? | **Opcional** em aprovar e rejeitar (conforme design doc e APR-03/04). |
| 3 | Exibir `prazo_sla`/atraso na fila? | **Sim, só visual** no card (stamp-badge Pendente / SLA restante / Atrasada). Lógica de cobrança fica em `sla-cobranca`. |
| 4 | Momento da 1ª geração de `resumo_ia`? | **Sob demanda** na primeira leitura da fila (`listarPendentes`) + **após avanço de etapa** (fire-and-forget). Alinhado ao `design.md` de `solicitacoes` (SOL não chama APR). |

## Decisões adicionais (Design)

| Tema | Decisão |
| --- | --- |
| Dependência de `solicitacoes` | Schema completo de `Solicitacao` entra nesta feature (T1) — espelha SOL design. UI/serviço de criação de solicitação **não** são desta feature. Link "Ver dados completos" aponta para `/solicitacoes/[id]` (página dona: `solicitacoes`). |
| Campo `comentario` | Adicionado em `Aprovacao` (`String?`, max 2000 via Zod) — design doc §4 omite, mas APR-03/04 exigem. |
| `Aprovacao.etapa` | `Int` 1-based (posição em `TipoFluxo.etapas`). `aprovador_role` espelha o `Role` daquela posição. |
| Lifecycle da linha `Aprovacao` | Stub criado ao **entrar** na etapa (`decisao`/`aprovador_id`/`decidido_em` null); preenchido na decisão. `resumo_ia` preenchido assíncrono (pode ficar null). |
| Tab "Sua equipe / Todas (RH)" do mockup | **Não implementar**. Fila é filtrada pelo papel do usuário (APR-05); tabs eram polish do protótipo. |
| Evento "avançou de etapa" | Stub `emitirAvancoEtapa(...)` no-op em `lib/events/solicitacaoEvents.ts` — `notificacoes` consome depois. |
| UI | Tokens, tipografia e layout do card de `docs/fluxorh-mockup.html` (`#screen-aprovacoes`). |
