# Ordem de Execução das Specs — FluxoRH

Este documento define a ordem de implementação recomendada para as 9 specs de feature em `.specs/features/`, com base nas dependências reais entre elas (extraídas das seções "Out of Scope" e das referências cruzadas de cada `spec.md`).

## Grafo de dependências

```
Fase 1 (paralelo, sem dependência entre si)
├── autenticacao-usuarios (AUTH)
├── configuracao-fluxos   (CONF)
└── auditoria-logs        (AUD)

Fase 2
└── solicitacoes (SOL)             ← depende de AUTH (identidade/gestor_id) + CONF (TipoFluxo/campos_formulario)

Fase 3
└── aprovacoes (APR)               ← depende de SOL (Solicitacao existe) + CONF (etapas) + AUTH (aprovador_role/gestor_id)

Fase 4 (paralelo)
├── notificacoes  (NOTIF)          ← depende de SOL (evento criação) + APR (eventos avanço/aprovação/rejeição)
└── sla-cobranca  (SLA)            ← depende de SOL (prazo_sla) + APR (etapa_atual/pendente) + NOTIF (dispara cobrança)

Fase 5 (paralelo)
├── dashboard-visao-geral (DASH)   ← depende de SOL + APR (status) + SLA (flag "atrasado")
└── painel-insights       (INSIGHT) ← depende de SOL + CONF (filtro por tipo); NÃO depende de APR/SLA/NOTIF
```

## Detalhamento por fase

### Fase 1 — Fundação (paralelizável entre 3 pessoas)

Nenhuma depende de outra feature do produto — só do design doc e do CLAUDE.md.

| Feature | Por que é fundação |
| --- | --- |
| `autenticacao-usuarios` | Toda outra feature precisa resolver `role`/`gestor_id` do usuário autenticado. |
| `configuracao-fluxos` | Nenhuma `Solicitacao` pode existir sem ao menos um `TipoFluxo` cadastrado. |
| `auditoria-logs` | Define o contrato do `logService` que quase todas as outras features chamam para gravar `AUDITORIA`/`ERRO`. |

### Fase 2 — Núcleo de criação

| Feature | Depende de | Motivo |
| --- | --- | --- |
| `solicitacoes` | AUTH, CONF | Precisa do usuário autenticado (solicitante) e de um `TipoFluxo` para renderizar o formulário dinâmico e criar a `Solicitacao`. |

### Fase 3 — Núcleo de aprovação (hero feature de IA)

| Feature | Depende de | Motivo |
| --- | --- | --- |
| `aprovacoes` | SOL, CONF, AUTH | Só existe algo a aprovar depois que `solicitacoes` cria a `Solicitacao`; usa `TipoFluxo.etapas` para saber a sequência de aprovadores e `gestor_id` para autorizar o Gestor certo. |

### Fase 4 — Eventos derivados (paralelizável entre 2 pessoas)

| Feature | Depende de | Motivo |
| --- | --- | --- |
| `notificacoes` | SOL, APR | Reage aos eventos de criação, avanço de etapa, aprovação final e rejeição. |
| `sla-cobranca` | SOL, APR, NOTIF | Precisa do `prazo_sla` (SOL) e da noção de etapa/pendência (APR); delega o envio da cobrança a `notificacoes`. Pode iniciar em paralelo a `notificacoes` usando um stub do disparo de cobrança e integrar depois. |

### Fase 5 — Visão agregada (paralelizável entre 2 pessoas)

| Feature | Depende de | Motivo |
| --- | --- | --- |
| `dashboard-visao-geral` | SOL, APR, SLA | Contadores de pendente/aprovado/rejeitado vêm de SOL+APR; o contador de "atrasado" depende do flag aditivo gravado por `sla-cobranca`. |
| `painel-insights` | SOL, CONF | Agrega `Solicitacao` por tipo/período independentemente do resultado da aprovação — não precisa esperar `aprovacoes`/`sla-cobranca`/`notificacoes` para ser funcional, só precisa de dados de `solicitacoes` existirem. Pode começar em paralelo à Fase 4 se houver capacidade. |

## Sugestão de divisão para um time de 2–3 pessoas

Caminho crítico (backbone): AUTH → SOL → APR → NOTIF/SLA → DASH. Uma pessoa deve seguir esse caminho do início ao fim, já que cada etapa bloqueia a próxima.

- **Pessoa A (backbone):** `autenticacao-usuarios` → `solicitacoes` → `aprovacoes`
- **Pessoa B:** `configuracao-fluxos` (Fase 1, entrega antes de `solicitacoes` começar) → `notificacoes` (Fase 4, após `aprovacoes`) → `dashboard-visao-geral` (Fase 5)
- **Pessoa C:** `auditoria-logs` (Fase 1, entrega antes de qualquer log ser gravado) → `sla-cobranca` (Fase 4, após `aprovacoes`) → `painel-insights` (pode adiantar em paralelo à Fase 4, já que só depende de `solicitacoes` + `configuracao-fluxos`)

## Notas

- As decisões cross-cutting já resolvidas (ver `context.md` de cada feature) — status "atrasado" aditivo, throttle de cobrança 1x/dia, tipos semânticos em `campos_formulario`, Gestor com acesso ao Painel de Insights, vínculo Supabase Auth por `id`+e-mail, bloqueio de edição de `TipoFluxo` com pendências — já estão refletidas nesta ordem e não devem ser re-discutidas durante a implementação.
- `painel-insights` é a única feature de Fase 5 que pode ser adiantada para rodar em paralelo à Fase 4, caso o time tenha capacidade ociosa — não tem dependência real em `aprovacoes`/`sla-cobranca`/`notificacoes`.
