# Configuração de Fluxos Specification

## Problem Statement

Os processos de RH (Vaga, Férias, Reembolso e outros) têm formulários e cadeias de aprovação diferentes entre si, e a empresa precisa poder adicionar/ajustar esses tipos sem depender de deploy ou de alteração de schema do banco. Sem uma tela de configuração, cada novo tipo de fluxo exigiria mudança de código. Esta feature dá ao RH_Admin controle direto para definir, via formulário simples, o nome de um `TipoFluxo`, os campos do seu formulário dinâmico (`campos_formulario`) e a sequência de papéis aprovadores (`etapas`).

## Goals

- [ ] RH_Admin cria um novo `TipoFluxo` (nome + `campos_formulario` + `etapas`) sem qualquer alteração de schema do banco — apenas um novo registro.
- [ ] RH_Admin edita um `TipoFluxo` existente pela mesma tela.
- [ ] Apenas usuários com papel `RH_ADMIN` conseguem criar/editar/gerenciar tipos de fluxo (bloqueio no backend, não só na UI).
- [ ] Toda criação/edição de `TipoFluxo` gera um `Log` tipo `AUDITORIA`.
- [ ] Um `TipoFluxo` salvo fica imediatamente disponível para ser consumido pela feature `solicitacoes` (Nova Solicitação) e percorrido pela feature `aprovacoes`.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| Canvas/motor de workflow visual (arrastar-e-soltar) | Fora de escopo explícito (design doc §10, CLAUDE.md). Configuração é por formulário/lista simples. |
| Múltiplos aprovadores em paralelo numa mesma etapa | Fora de escopo (design doc §10). `etapas` é lista sequencial, um papel por etapa. |
| Renderização e preenchimento do formulário dinâmico pelo solicitante | Pertence à feature `solicitacoes`. Aqui só se **define** `campos_formulario`, não se consome. |
| Percorrer/avançar as etapas durante a aprovação | Pertence à feature `aprovacoes`. Aqui só se **define** a lista `etapas`. |
| Configuração de duração de SLA por fluxo/etapa | O modelo `TipoFluxo` (design doc §4) não inclui campo de SLA; `prazo_sla` vive em `Solicitacao`. Ver [[sla-cobranca]]. Ver Questões em Aberto. |
| Exclusão/remoção de `TipoFluxo` | Design doc §5 menciona apenas "criar/editar". Ver Questões em Aberto. |
| Upload de arquivo como tipo de campo do formulário | Fora de escopo (design doc §10, CLAUDE.md). Usar campo de texto/link. |

---

## User Stories

### P1: Criar tipo de fluxo ⭐ MVP

**User Story**: Como RH_Admin, quero criar um novo tipo de fluxo definindo seu nome, os campos do formulário e a sequência de papéis aprovadores, para habilitar um novo processo de RH sem precisar de alteração de código ou de schema.

**Why P1**: É a razão de existir da feature e o pré-requisito para `solicitacoes` e `aprovacoes` funcionarem — sem ao menos um `TipoFluxo` cadastrado, nenhuma solicitação pode ser aberta nem aprovada.

**Acceptance Criteria**:

1. WHEN um RH_Admin submete a criação de um `TipoFluxo` com `nome` não vazio, `campos_formulario` e uma lista `etapas` com pelo menos um papel válido THEN o sistema SHALL persistir um novo registro `TipoFluxo` e retornar sucesso.
2. WHEN o `TipoFluxo` é persistido THEN o sistema SHALL armazenar `campos_formulario` e `etapas` como campos JSON, sem executar migration nem alterar o schema do banco.
3. WHEN a lista `etapas` é fornecida THEN o sistema SHALL preservar a ordem informada (a posição no array define a ordem de aprovação) e SHALL aceitar apenas os papéis `GESTOR` e/ou `RH_ADMIN` como aprovadores.
4. WHEN a criação é concluída com sucesso THEN o sistema SHALL gravar um `Log` tipo `AUDITORIA` (entidade `TipoFluxo`, ação de criação, `usuario_id` do RH_Admin).
5. WHEN um usuário que não é `RH_ADMIN` (SOLICITANTE ou GESTOR) tenta criar um `TipoFluxo` THEN o sistema SHALL bloquear a operação no backend e retornar erro de autorização, sem persistir nada.
6. WHEN o `nome` está vazio, `etapas` está vazio, ou `etapas` contém um papel inválido THEN o sistema SHALL rejeitar a requisição com erro de validação (Zod) e não persistir nada.
7. WHEN o `TipoFluxo` é criado com sucesso THEN ele SHALL ficar imediatamente disponível para consulta pelas features `solicitacoes` e `aprovacoes`.

**Independent Test**: Autenticar como RH_Admin, criar o tipo "Vaga" com `etapas` = [GESTOR, RH_ADMIN] e alguns campos, e verificar (a) que o registro existe no banco como JSON, (b) que um `Log` AUDITORIA foi gravado, e (c) que uma tentativa da mesma criação como GESTOR é bloqueada.

---

### P1: Listar e visualizar tipos de fluxo ⭐ MVP

**User Story**: Como RH_Admin, quero ver a lista dos tipos de fluxo já cadastrados e abrir os detalhes de um deles, para saber o que já existe antes de criar um novo e para escolher qual editar.

**Why P1**: A tela de configuração (design doc, Tela 7) precisa exibir os tipos existentes; sem listagem, o RH_Admin não tem como gerenciar nem editar o que já foi criado.

**Acceptance Criteria**:

1. WHEN um RH_Admin acessa a tela de Configuração de Fluxos THEN o sistema SHALL retornar a lista de todos os `TipoFluxo` cadastrados (nome e identificador).
2. WHEN um RH_Admin abre um `TipoFluxo` da lista THEN o sistema SHALL retornar seus `campos_formulario` e `etapas` completos, na ordem armazenada.
3. WHEN não existe nenhum `TipoFluxo` cadastrado THEN o sistema SHALL retornar uma lista vazia (estado que a UI trata como "nenhum tipo de fluxo configurado ainda"), sem erro.
4. WHEN um usuário que não é `RH_ADMIN` tenta acessar a listagem de gestão de tipos de fluxo THEN o sistema SHALL bloquear no backend e retornar erro de autorização.

**Independent Test**: Com dois `TipoFluxo` cadastrados, autenticar como RH_Admin e verificar que ambos aparecem na listagem e que abrir um deles retorna `campos_formulario` e `etapas` corretos; repetir como SOLICITANTE e confirmar bloqueio.

---

### P2: Editar tipo de fluxo

**User Story**: Como RH_Admin, quero editar um tipo de fluxo existente (nome, campos e etapas), para corrigir ou evoluir um processo já configurado sem ter que recriá-lo.

**Why P2**: O design doc pede "criar/editar", mas o corte vertical mínimo que desbloqueia `solicitacoes`/`aprovacoes` é criar + listar; a edição é refinamento importante, porém não é o primeiro caminho de valor.

**Acceptance Criteria**:

1. WHEN um RH_Admin submete alterações válidas em um `TipoFluxo` existente THEN o sistema SHALL atualizar o registro (nome, `campos_formulario` e/ou `etapas`) e retornar sucesso.
2. WHEN a edição é concluída com sucesso THEN o sistema SHALL gravar um `Log` tipo `AUDITORIA` (entidade `TipoFluxo`, `entidade_id` do registro editado, ação de edição, `usuario_id` do RH_Admin).
3. WHEN a edição viola as regras de validação (nome vazio, `etapas` vazio, papel inválido) THEN o sistema SHALL rejeitar a operação e SHALL manter o registro inalterado.
4. WHEN um usuário que não é `RH_ADMIN` tenta editar um `TipoFluxo` THEN o sistema SHALL bloquear no backend e retornar erro de autorização.
5. WHEN a edição referencia um `TipoFluxo` inexistente THEN o sistema SHALL retornar erro "não encontrado", sem criar um novo registro.

**Independent Test**: Autenticar como RH_Admin, editar o tipo "Vaga" trocando as etapas de [GESTOR, RH_ADMIN] para [RH_ADMIN], salvar, e verificar que o registro foi atualizado e que um `Log` AUDITORIA de edição foi gravado.

---

## Edge Cases

- WHEN `etapas` é enviado como lista vazia THEN o sistema SHALL rejeitar com erro de validação (todo fluxo precisa de pelo menos um aprovador).
- WHEN `etapas` contém um papel que não é aprovador (ex: `SOLICITANTE`) ou um valor fora do enum de papéis THEN o sistema SHALL rejeitar com erro de validação.
- WHEN `campos_formulario` não é um JSON válido / não segue a estrutura esperada de definição de campos THEN o sistema SHALL rejeitar com erro de validação e não persistir.
- WHEN `campos_formulario` é enviado sem nenhum campo (lista vazia) THEN o sistema SHALL tratar conforme decisão em aberto (ver Questões em Aberto) — o comportamento padrão proposto é rejeitar, exigindo ao menos um campo.
- WHEN dois `TipoFluxo` são criados com o mesmo `nome` THEN o sistema SHALL tratar conforme decisão em aberto sobre unicidade de nome (ver Questões em Aberto).
- WHEN o `nome` contém apenas espaços em branco THEN o sistema SHALL tratar como vazio e rejeitar.
- WHEN a requisição de criação/edição não está autenticada THEN o sistema SHALL retornar erro de autenticação antes de qualquer verificação de papel.

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CONF-01 | P1: Criar tipo de fluxo / P1: Listar / P2: Editar (autorização RH_ADMIN backend) | Design | Pending |
| CONF-02 | P1: Criar tipo de fluxo (nome) | Design | Pending |
| CONF-03 | P1: Criar tipo de fluxo (`campos_formulario` JSON) | Design | Pending |
| CONF-04 | P1: Criar tipo de fluxo (`etapas` ordenadas, papéis GESTOR/RH_ADMIN) | Design | Pending |
| CONF-05 | P1: Criar tipo de fluxo (persistência JSON sem migration, disponível para consumo) | Design | Pending |
| CONF-06 | P1: Listar e visualizar tipos de fluxo | Design | Pending |
| CONF-07 | P2: Editar tipo de fluxo | Design | Pending |
| CONF-08 | P1: Criar / P2: Editar (validação de entrada com Zod) | Design | Pending |
| CONF-09 | P1: Criar / P2: Editar (Log AUDITORIA em criação/edição) | Design | Pending |

**ID format:** `[CATEGORY]-[NUMBER]` (e.g., `AUTH-01`, `CART-03`, `NOTIF-02`)

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 9 total, 0 mapped to tasks, 9 unmapped ⚠️ (mapeamento ocorre na fase Tasks)

---

## Success Criteria

How we know the feature is successful:

- [ ] Um RH_Admin consegue criar um novo `TipoFluxo` de ponta a ponta pela tela, e ele aparece imediatamente na listagem sem qualquer deploy ou migration.
- [ ] Um `TipoFluxo` recém-criado é consumível pela feature `solicitacoes` (aparece como opção em Nova Solicitação) e suas `etapas` são percorríveis por `aprovacoes`.
- [ ] Tentativas de criar/editar/gerenciar tipos de fluxo por usuários SOLICITANTE ou GESTOR são bloqueadas no backend em 100% dos casos.
- [ ] Toda criação e toda edição de `TipoFluxo` têm um `Log` tipo `AUDITORIA` correspondente, rastreável na tela de Auditoria/Logs.
- [ ] Entradas inválidas (nome vazio, etapas vazias, papel inválido) são rejeitadas com mensagem de validação clara e não deixam registros parciais.

---

## Questões em Aberto

Zonas cinzentas relevantes para o usuário decidir — não assumidas nesta spec:

1. ✅ **RESOLVIDO** (ver `context.md`) — **Contrato de `campos_formulario`**: tipos de campo semânticos (texto → texto, número → número, data → data, etc.). Lista exata de tipos/atributos de validação fica para o Design.
2. ✅ **RESOLVIDO** (ver `context.md`) — **Edição de um `TipoFluxo` com solicitações em andamento**: edição bloqueada quando houver ao menos uma `Solicitacao` pendente vinculada ao tipo.
3. ✅ **DECIDIDO NO DESIGN** (ver `design.md`) — **Unicidade do `nome`**: `nome` é único (`@unique`).
4. ✅ **DECIDIDO NO DESIGN** (ver `design.md`) — **`campos_formulario` vazio**: rejeitado — exige ao menos um campo.
5. **Exclusão/desativação de `TipoFluxo`**: o design doc menciona apenas "criar/editar". Não há como aposentar um tipo que não deve mais ser usado (ex: escondê-lo de Nova Solicitação sem apagar histórico). **Decisão necessária**: incluir um flag de ativo/inativo agora ou deixar para pós-MVP.
6. **Configuração de SLA por fluxo/etapa**: `prazo_sla` é campo de `Solicitacao`, e `TipoFluxo` (design doc §4) não tem campo de SLA — então a duração do SLA (ex: 48h) hoje não é configurável aqui. Confirmar se ela deve ser um valor global (dono da feature [[sla-cobranca]]) ou passar a ser configurável por `TipoFluxo` (o que ampliaria o schema desta feature).
