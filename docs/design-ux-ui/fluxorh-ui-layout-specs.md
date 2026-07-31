# FluxoRH — Especificações Técnicas de UI/UX e Diagramas Mermaid para Leitura por IA

> **Arquivo de Origem:** [docs/fluxorh-mockup.html](file:///c:/Users/fabio/OneDrive/Documentos/Workspaces/ObraPrima/rhop/docs/fluxorh-mockup.html)  
> **Objetivo:** Fornecer um guia formal, altamente estruturado e otimizado para parsing por modelos de IA e engenheiros de frontend, definindo tokens visuais, hierarquia de componentes, matrizes de permissão por papel, fluxos de navegação e diagramas Mermaid de todas as telas do sistema **FluxoRH**.

---

## 1. Design System & Tokens Semânticos

O sistema visual do FluxoRH é construído sobre uma metáfora editorial/institucional ("documento oficial com chancela digital e carimbos de estado"), combinando três famílias tipográficas e um sistema rigoroso de tokens de cor e texturas.

### 1.1 Paleta de Cores (Variáveis CSS)

| Token CSS | Hex | Categoria | Uso Semântico |
|---|---|---|---|
| `--paper` | `#F3F6FC` | Background Base | Fundo da aplicação e tela de login |
| `--paper-raised` | `#FFFFFF` | Superfície Elevada | Cards, tabelas, modais, superfícies de leitura |
| `--ink` | `#16233D` | Texto Principal | Cor padrão de texto de alto contraste |
| `--ink-soft` | `#5B6B87` | Texto Secundário | Rótulos, metadados, descrições secundárias |
| `--azul-900` | `#142A52` | Marca & Sidebar | Fundo da Sidebar, cabeçalhos principais, modal head |
| `--azul-800` | `#1B356A` | Primário Escuro | Botões ativos, topo de gráficos, FAB de ajuda |
| `--azul-700` | `#1F3F7A` | Acento Corporativo | Itens de menu selecionados, botões secundários |
| `--azul-500` | `#3567B0` | Interatividade | Links, foco de inputs, destaques de borda |
| `--azul-200` | `#C7D6F0` | Suporte Suave | Bordas de elementos selecionados, badges neutras |
| `--azul-100` | `#E4ECFA` | Fundo de Seleção | Hover em tabelas, fundos de chips, background de abas |
| `--amarelo-700` | `#B87F15` | Acento de Alerta | Texto do tag de IA, borda de selo institucional |
| `--amarelo-600` | `#DDA02A` | CTA Destaque | Botão primário "Entrar" / "Enviar", acento ativo |
| `--amarelo-400` | `#F0BE55` | Destaque Visual | Hover em botões primários, texto em destaque no login |
| `--amarelo-100` | `#FBEFD3` | IA Surface | Fundo do box de Resumo por IA (`.callout-ia`) |
| `--linha` | `#DCE3F0` | Divisor | Linhas de tabela, bordas de card, divisores horizontais |
| `--verde` | `#2F8F62` | Status Positivo | Carimbo "Aprovado", taxas de SLA no prazo |
| `--verde-bg` | `#E4F3EC` | Fundo Positivo | Background do badge "Aprovado" |
| `--vermelho` | `#C24B3B` | Status Negativo | Carimbo "Rejeitado", botões de rejeição, logs de erro |
| `--vermelho-bg` | `#FBE9E6` | Fundo Negativo | Background do badge "Rejeitado" |
| `--laranja` | `#CC5B23` | Status Alerta | Carimbo "Atrasado", avisos de SLA estourado |
| `--laranja-bg` | `#FBEADE` | Fundo Alerta | Background do badge "Atrasado" |

### 1.2 Sistema Tipográfico

1. **Display / Headlines:** `Fraunces` (Serif, pesos 500/600/700)
   - Uso: Títulos principais (`<h1>`, `<h2>`, `<h3>`), selo institucional, valores em stat tiles.
2. **Interface / Corpo:** `Inter` (Sans-serif, pesos 400/500/600/700)
   - Uso: Corpo de texto, formulários, botões, tabelas, itens de navegação.
3. **Dados / Código / Metadados:** `IBM Plex Mono` (Monospace, pesos 500/600)
   - Uso: Protocolos (`REQ-2026-XXXX`), carimbos de status (`.stamp-badge`), eyebrows, tags de IA, timestamps.

### 1.3 Assinaturas Visuais

- **Carimbos de Estado (`.stamp-badge`):** Badges retangulares com borda tracejada (`1.5px dashed`), fonte `IBM Plex Mono`, leve rotação em CSS (`transform: rotate(-1.4deg)`).
- **Textura de Papel Pautado (`.ruled`):** Gradient linear repetitivo simulando caderno/papel timbrado corporativo (`repeating-linear-gradient`).
- **Resumo por IA (`.callout-ia`):** Container com fundo amarelo suave (`--amarelo-100`), borda esquerda viva (`--amarelo-600`), tag superior `✦ RESUMO POR IA`.
- **Selo Institucional (`.seal`):** Círculo com iniciais `FR`, borda dourada dupla com traçado pontilhado (`outline: 1.5px dashed`).

---

## 2. Diagrama de Navegação & Roteamento por Papel

```mermaid
graph TD
    LOGIN["Screen 0: Login (#screen-login)"] -->|Autenticação Sucesso| APP["App Shell (#app-shell)"]
    
    subgraph APP_NAV["Navegação Principal do App Shell"]
        APP --> SCREEN_MINHAS["Screen 1: Minhas Solicitações (#screen-minhas)"]
        APP --> SCREEN_NOVA["Screen 2: Nova Solicitação (#screen-nova)"]
        APP --> SCREEN_APROVACOES["Screen 3: Aprovações Pendentes (#screen-aprovacoes)"]
        APP --> SCREEN_DASHBOARD["Screen 4: Dashboard de Visão Geral (#screen-dashboard)"]
        APP --> SCREEN_PIPELINE["Screen 5: Pipeline de Aprovações (#screen-pipeline)"]
        APP --> SCREEN_INSIGHTS["Screen 6: Painel de Insights (#screen-insights)"]
        APP --> SCREEN_FLUXOS["Screen 7: Configuração de Fluxos (#screen-fluxos)"]
        APP --> SCREEN_AUDITORIA["Screen 8: Auditoria & Logs (#screen-auditoria)"]
        APP --> SCREEN_CUSTOM["Screen Dinâmica: Rascunho (#screen-customX)"]
    end

    subgraph GLOBAL_COMPONENTS["Componentes Flutuantes Globais"]
        FAB["FAB Ajuda (#help-fab)"] -->|Clique| MODAL_ISSUE["Modal Reportar Issue (#help-modal-overlay)"]
        ROLE_SWITCH["Seletor de Papéis (Sidebar)"] -->|Troca de Papel| GUARD["Guarda de Acesso (applyRole)"]
    end

    classDef public fill:#142A52,color:#fff,stroke:#DDA02A,stroke-width:2px;
    classDef protected fill:#1F3F7A,color:#fff,stroke:#C7D6F0;
    classDef modal fill:#B87F15,color:#fff,stroke:#142A52;
    
    class LOGIN public;
    class APP,SCREEN_MINHAS,SCREEN_NOVA,SCREEN_APROVACOES,SCREEN_DASHBOARD,SCREEN_PIPELINE,SCREEN_INSIGHTS,SCREEN_FLUXOS,SCREEN_AUDITORIA protected;
    class MODAL_ISSUE modal;
```

---

## 3. Matriz de Permissões por Papel (RBAC)

| ID da Tela | Nome da Tela | SOLICITANTE | GESTOR | RH_ADMIN |
|---|---|:---:|:---:|:---:|
| `screen-login` | Tela de Login | ✓ | ✓ | ✓ |
| `screen-minhas` | Minhas Solicitações | ✓ | ✓ | ✓ |
| `screen-nova` | Nova Solicitação | ✓ | ✓ | ✓ |
| `screen-aprovacoes` | Aprovações Pendentes | ✗ | ✓ | ✓ |
| `screen-dashboard` | Dashboard de Visão Geral | ✗ | ✓ | ✓ |
| `screen-pipeline` | Pipeline de Aprovações | ✗ | ✗ | ✓ |
| `screen-insights` | Painel de Insights | ✗ | ✓ | ✓ |
| `screen-fluxos` | Configuração de Fluxos | ✗ | ✗ | ✓ |
| `screen-auditoria` | Auditoria & Logs | ✗ | ✗ | ✓ |
| `customX` | Páginas Personalizadas (Dinam.) | ✓ | ✓ | ✓ |

---

## 4. Especificação Detalhada das Telas

### 4.1 Screen 0: Login (`#screen-login`)

- **Objetivo:** Autenticação corporativa e apresentação da proposta de valor do sistema.
- **Estrutura Visual:** Layout Grid em 2 colunas (Painel Visual Ilustrativo `1.1fr` + Formulário de Acesso `1fr`).
- **Comportamento Responsivo:** Em telas `< 860px`, o painel visual é ocultado e o card passa a ser 1 coluna.

```mermaid
graph TB
    subgraph LOGIN_CARD["Card de Login (.login-card)"]
        subgraph VISUAL_PANEL["Painel Esquerdo: Branding (.login-visual)"]
            BRAND["Brandmark: Selo FR + 'FluxoRH'"]
            QUOTE["Frase Chave: 'Resumo pronto. Decisão em segundos'"]
            META["Rodapé: OBRA PRIMA · PLATAFORMA RH"]
        end
        
        subgraph FORM_PANEL["Painel Direito: Formulário (.login-form-wrap)"]
            EYEBROW["Eyebrow: ACESSAR CONTA"]
            TITLE["Título: Entrar no FluxoRH"]
            INPUT_EMAIL["Input Email (marina.costa@empresa.com)"]
            INPUT_PASS["Input Password (••••••••)"]
            ROW_OPT["Opções: Checkbox 'Manter conectado' + Link 'Esqueci a senha'"]
            BTN_LOGIN["Botão Primário: Entrar -> onclick enterApp()"]
            FOOT["Rodapé: Acesso restrito a colaboradores"]
        end
    end
```

---

### 4.2 Shell da Aplicação (`.app-shell`)

- **Objetivo:** Estrutura container permanente contendo Menu Lateral (Sidebar), Barra Superior (Topbar), Área de Conteúdo Flexível e FAB Flutuante.

```mermaid
graph LR
    subgraph APP_SHELL["Shell Principal (.app-shell)"]
        subgraph SIDEBAR["Sidebar (.sidebar - 250px)"]
            SB_BRAND["Branding: Selo FR + FluxoRH"]
            
            subgraph NAV_GROUPS["Grupos de Navegação Acordeão"]
                G1["Group 1: Meu trabalho (minhas, nova, aprovacoes)"]
                G2["Group 2: Visão geral (dashboard, pipeline, insights)"]
                G3["Group 3: Administração (fluxos, auditoria)"]
                G4["Group 4: Páginas (+ Adicionar página)"]
            end
            
            subgraph SB_FOOTER["Rodapé da Sidebar"]
                ROLE_LABEL["Label: VISUALIZAR COMO"]
                ROLE_TOGGLES["Buttons: Solicitante / Gestor / RH_Admin"]
                LOGOUT["Link: Sair -> onclick exitApp()"]
            end
        end
        
        subgraph MAIN_CONTENT["Área Principal (.main)"]
            subgraph TOPBAR["Topbar (.topbar)"]
                TB_INFO["Eyebrow da Área + Título da Tela Ativa"]
                TB_USER["User Chip: Avatar, Nome e Cargo do Papel Ativo"]
            end
            
            CONTAINER["Screen Container (.screen-container max 1180px)"]
        end
    end
```

---

### 4.3 Screen 1: Minhas Solicitações (`#screen-minhas`)

- **Objetivo:** Listar solicitações abertas pelo usuário logado com seus respetivos status, SLA e etapas atuais.
- **Componentes:** Cabeçalho com CTA "+ Nova Solicitação", Tabela de dados com colunas: Protocolo, Tipo, Etapa atual, Status (Carimbo), SLA e Data de abertura.

```mermaid
graph TB
    subgraph MINHAS_SCREEN["Tela: Minhas Solicitações (#screen-minhas)"]
        HEAD["Header Row: Título + Botão '+ Nova Solicitação' -> goTo('nova')"]
        
        subgraph TABLE_CARD["Card Container de Tabela (.card)"]
            TABLE["Tabela de Solicitações"]
            
            COL1["Col 1: Protocolo + Subtítulo de Valor/Detalhe"]
            COL2["Col 2: Badge de Tipo (.chip-tipo)"]
            COL3["Col 3: Etapa Atual (ex: Gestor - Marina)"]
            COL4["Col 4: Status com Carimbo (.stamp-badge: pendente/rejeitado/aprovado)"]
            COL5["Col 5: Tempo de SLA Restante (mono orange)"]
            COL6["Col 6: Data de Abertura (mono)"]
        end
    end
```

---

### 4.4 Screen 2: Nova Solicitação (`#screen-nova`)

- **Objetivo:** Permitir ao usuário escolher um tipo de fluxo e preencher o formulário correspondente.
- **Componentes:** Seleção visual de fluxo (Cards Vaga/Férias/Reembolso), Formulário dinâmico com textura pautada (`.ruled`), barra de acompanhamento das etapas do fluxo e botões de ação ("Salvar rascunho", "Enviar solicitação").

```mermaid
graph TB
    subgraph NOVA_SCREEN["Tela: Nova Solicitação (#screen-nova)"]
        TITLE["Título: Nova Solicitação"]
        
        subgraph STEP1["Etapa 1: Seleção de Tipo de Fluxo"]
            CARD_VAGA["Card Vaga (Icon V)"]
            CARD_FERIAS["Card Férias (Icon F)"]
            CARD_REEMBOLSO["Card Reembolso (Icon R) - Selecionado"]
        end
        
        subgraph STEP2["Etapa 2: Formulário Dinâmico (.card.ruled)"]
            FORM_TITLE["Eyebrow: 2. Detalhes — Reembolso"]
            FIELD_VALOR["Input: Valor (R$)"]
            FIELD_DATA["Input: Data da despesa"]
            FIELD_DESC["Textarea: Descrição"]
            FIELD_RECIBO["Input: Link do recibo / NF"]
            
            subgraph FORM_FOOTER["Barra Inferior do Formulário"]
                STEPS_PREVIEW["Etapas Preview: Gestor -> RH_Admin"]
                BTN_RASCUNHO["Botão Ghost: Salvar rascunho"]
                BTN_SUBMIT["Botão Primary: Enviar solicitação -> goTo('minhas')"]
            end
        end
    end
```

---

### 4.5 Screen 3: Aprovações Pendentes (`#screen-aprovacoes`)

- **Objetivo (Hero Feature):** Exibir os cards de solicitação pendentes de aprovação, destacando o **Resumo Gerado por IA** para tomada de decisão ágil.
- **Componentes:** Abas de alternância ("Sua equipe" vs "Todas RH"), Cards de Aprovação com Badge de Tipo, Protocolo, Badge de SLA/Atraso, **Callout de IA (`.callout-ia`)**, divisor e botões de ação ("Rejeitar" / "Aprovar").

```mermaid
graph TB
    subgraph APROVACOES_SCREEN["Tela: Aprovações Pendentes (#screen-aprovacoes)"]
        HEAD["Header: Título + Contagem (3 pendentes) + Tab Toggle (Sua equipe / Todas)"]
        
        subgraph CARD_STACK["Lista de Cards de Aprovação (.stack-16)"]
            subgraph APR_CARD["Card de Aprovação (.approval-card)"]
                CARD_HEAD["Cabeçalho: Tipo + Nome/Cargo Solicitante + Protocolo + Carimbo SLA"]
                
                subgraph IA_BOX["Container de Destaque da IA (.callout-ia)"]
                    TAG_IA["Tag Mono: ✦ RESUMO POR IA"]
                    TEXT_IA["Texto Sintetizado: 'Reembolso R$ 340 transporte cliente. Recibo anexado. Dentro da política...'"]
                end
                
                PERF_LINE["Linha Picotada Divisora (.approval-perf)"]
                
                CARD_ACTIONS["Ações: Link 'Ver dados completos' + Botões 'Rejeitar' (Ghost Red) e 'Aprovar' (Primary)"]
            end
        end
    end
```

---

### 4.6 Screen 4: Dashboard de Visão Geral (`#screen-dashboard`)

- **Objetivo:** Fornecer indicadores métricos de volume e status das solicitações com tabela sintética.
- **Componentes:** Filtros de tipo/período, Grid de 4 Stat Tiles (Pendentes, Atrasadas [Accent Orange], Aprovadas, Rejeitadas), Tabela de resumo das últimas solicitações.

```mermaid
graph TB
    subgraph DASHBOARD_SCREEN["Tela: Dashboard (#screen-dashboard)"]
        HEAD["Header: Título + Filtros (Tipo de Fluxo, Período 30/90 dias)"]
        
        subgraph STATS_GRID["Grid de Estatísticas (.stats-grid 4 cols)"]
            TILE_PEND["Tile 1: Pendentes (7)"]
            TILE_ATRAS["Tile 2: Atrasadas (2) - Borda Laranja"]
            TILE_APROV["Tile 3: Aprovadas (24) - Verde"]
            TILE_REJ["Tile 4: Rejeitadas (3) - Vermelho"]
        end
        
        subgraph DASH_TABLE["Tabela Sintética de Status (.card)"]
            TABLE_ROWS["Linhas: Protocolo | Solicitante | Tipo | Status (Carimbo) | Etapa Atual"]
        end
    end
```

---

### 4.7 Screen 5: Pipeline de Aprovações (`#screen-pipeline`)

- **Objetivo:** Visão estilo Kanban do fluxo de aprovações por colunas de etapa (Visão exclusiva do RH_Admin).
- **Componentes:** Colunas Kanban (Aguardando Gestor, Aguardando RH_Admin, Aprovado, Rejeitado), contadores redondos por coluna, cards kanban com indicador visual de SLA estourado (`.late`), lista expansível com botão "+ N outras concluídas/rejeitadas".

```mermaid
graph TB
    subgraph PIPELINE_SCREEN["Tela: Pipeline de Aprovações (#screen-pipeline)"]
        HEAD["Header: Título + Filtros (Tipo de Fluxo, Empresa/Área)"]
        
        subgraph KANBAN_BOARD["Quadro Kanban (.kanban horizontal scroll)"]
            subgraph COL_GESTOR["Coluna 1: Aguardando Gestor (Count: 1)"]
                CARD_G1["Card: Camila Duarte (Férias) - Pendente"]
            end
            
            subgraph COL_RH["Coluna 2: Aguardando RH_Admin (Count: 2)"]
                CARD_RH1["Card: Rafael Lima (Reembolso) - Pendente"]
                CARD_RH2["Card: Marina Costa (Vaga) - (.late Atrasado)"]
            end
            
            subgraph COL_APROV["Coluna 3: Aprovado (Count: 6)"]
                CARD_AP1["Card Done: Camila Duarte"]
                CARD_AP2["Card Done: João Prado"]
                LIST_EXP1["Lista Oculta (.kanban-more-list) + Botão +4 outras"]
            end
            
            subgraph COL_REJ["Coluna 4: Rejeitado (Count: 3)"]
                CARD_RJ1["Card Rejected: João Prado"]
                LIST_EXP2["Lista Oculta + Botão +2 outras"]
            end
        end
    end
```

---

### 4.8 Screen 6: Painel de Insights (`#screen-insights`)

- **Objetivo (Feature de IA Agregada):** Apresentar dados quantitativos consolidados e a interpretação sintética da IA sobre tendências e gargalos de RH.
- **Componentes:** Gráfico de barras simples em CSS (Vagas por área), Callout de síntese de IA sobre gargalos, tabela de SLA e tempo médio por tipo de fluxo.

```mermaid
graph TB
    subgraph INSIGHTS_SCREEN["Tela: Painel de Insights (#screen-insights)"]
        HEAD["Header: Título + Filtros (Tipo de Fluxo, Período)"]
        
        subgraph CARD_CHART["Card 1: Gráfico de Barras CSS (.bar-chart)"]
            BAR1["Engenharia (42%) - Altura 150px"]
            BAR2["Vendas (24%) - Altura 86px"]
            BAR3["Marketing (18%) - Altura 65px"]
            BAR4["Operações (16%) - Altura 58px"]
        end
        
        subgraph IA_INSIGHT_BOX["Card 2: Leitura Sintética da IA (.callout-ia)"]
            TAG_INSIGHT["Tag Mono: ✦ LEITURA DA IA SOBRE OS NÚMEROS ACIMA"]
            TEXT_INSIGHT["Texto: 'Quase metade das vagas está concentrada em Engenharia, e o tempo de aprovação é 35% maior...'"]
        end
        
        subgraph CARD_SLA_TABLE["Card 3: Tabela de SLA e Tempo Médio"]
            SLA_ROWS["Linhas: Tipo (Vaga/Férias/Reembolso) | Tempo Médio | % Dentro do SLA"]
        end
    end
```

---

### 4.9 Screen 7: Configuração de Fluxos (`#screen-fluxos`)

- **Objetivo:** Permitir ao RH_Admin visualizar e gerenciar os tipos de fluxo, suas etapas e os campos do formulário associado.
- **Componentes:** Cards de tipos de fluxo (Vaga, Férias, Reembolso), pílulas indicadoras da ordem das etapas (`.step-pill`), container de campos de formulário ativos com rótulo e tipo desabilitado.

```mermaid
graph TB
    subgraph FLUXOS_SCREEN["Tela: Configuração de Fluxos (#screen-fluxos)"]
        HEAD["Header: Título + Botão '+ Novo tipo de fluxo'"]
        
        subgraph FLUXO_CARDS["Lista de Configurações (.stack-16)"]
            CARD_FLUXO_VAGA["Card Vaga: Botão Editar + Etapas (1. Gestor -> 2. RH_Admin)"]
            CARD_FLUXO_FERIAS["Card Férias: Botão Editar + Etapas (1. Gestor)"]
            
            subgraph CARD_FLUXO_REEMBOLSO["Card Reembolso (Ativo em Destaque)"]
                HEAD_REEMB["Título 'Reembolso' + Botão Editar"]
                STEPS_REEMB["Etapas: 1. Gestor -> 2. RH_Admin"]
                DIVIDER_FIELDS["Divisor Mono: CAMPOS DO FORMULÁRIO"]
                GRID_FIELDS["Grid 2 Cols: Valor (numérico), Data (data), Descrição (texto), Link recibo (link)"]
            end
        end
    end
```

---

### 4.10 Screen 8: Auditoria & Logs (`#screen-auditoria`)

- **Objetivo:** Exibir logs técnicos e de auditoria de negócios para rastreabilidade completa de ações e exceções do sistema.
- **Componentes:** Filtro por tipo de log (Auditoria vs Erro) e busca textual, Tabela de Logs com Timestamp, Tipo (`.log-tipo.auditoria` azul vs `.log-tipo.erro` vermelho), Entidade/Protocolo, Descrição da ação e Usuário/Ator do sistema.

```mermaid
graph TB
    subgraph AUDITORIA_SCREEN["Tela: Auditoria & Logs (#screen-auditoria)"]
        HEAD["Header: Título + Filtros (Tipo de Log: Todos/Auditoria/Erro, Busca por protocolo/usuário)"]
        
        subgraph LOGS_TABLE["Card de Tabela de Logs (.card)"]
            LOG_ROW1["Row 1: 30/07 14:22 | Auditoria (Blue) | Req #0417 | Etapa avançada: Solicitante -> Gestor | sistema"]
            LOG_ROW2["Row 2: 30/07 09:10 | Erro (Red) | Aprov #0405 | Falha ao gerar resumo_ia (timeout OpenAI) | sistema"]
            LOG_ROW3["Row 3: 29/07 17:45 | Auditoria (Blue) | Aprov #0412 | Decisão registrada: Aprovado | Beatriz Nunes"]
        end
    end
```

---

### 4.11 Componente Flutuante: Botão de Ajuda & Modal de Issue (`#help-modal-overlay`)

- **Objetivo:** Permitir que o usuário reporte bugs ou melhorias diretamente da interface, enviando o contexto da tela atual para a abertura de issues no GitHub.

```mermaid
graph TB
    FAB_BTN["FAB Flutuante (#help-fab '?') - Canto inferior direito"] -->|Clique| MODAL["Modal Overlay (#help-modal-overlay)"]
    
    subgraph MODAL_CARD["Card do Modal (.modal-card)"]
        MODAL_HEAD["Cabeçalho: Selo FR + 'Reportar algo' + Botão Fechar (×)"]
        
        subgraph MODAL_FORM["Formulário de Reporte"]
            TOGGLE_TYPE["Seletor Tipo: Abas Bug (ativo) / Melhoria / Dúvida"]
            INPUT_TITLE["Input: Título da Issue"]
            TEXT_DESC["Textarea: Descrição do Problema/Idéia"]
            CONTEXT_LABEL["Preview Contexto: 'Tela atual: [Nome da Tela Ativa]'"]
            
            subgraph MODAL_ACTIONS["Barra de Ações"]
                BTN_CANCEL["Botão Ghost: Cancelar -> closeHelpModal()"]
                BTN_SUBMIT["Botão Primary: Abrir issue no GitHub ↗ -> window.open(URL_GITHUB)"]
            end
        end
    end
```

---

## 5. Fluxo de Dados e Máquina de Estados de Solicitação

```mermaid
stateDiagram-v2
    [*] --> RASCUNHO : Salvar rascunho
    [*] --> PENDENTE_GESTOR : Enviar solicitação
    RASCUNHO --> PENDENTE_GESTOR : Enviar formulário
    
    state PENDENTE_GESTOR {
        [*] --> GERAR_IA_STEP1
        GERAR_IA_STEP1 --> NOTIFICAR_GESTOR : Sucesso IA / Fallback sem resumo
        NOTIFICAR_GESTOR --> AGUARDANDO_DECISAO_GESTOR
    }
    
    AGUARDANDO_DECISAO_GESTOR --> REJEITADO : Gestor Rejeita
    AGUARDANDO_DECISAO_GESTOR --> PENDENTE_RH : Gestor Aprova (se houver Etapa 2)
    AGUARDANDO_DECISAO_GESTOR --> APROVADO : Gestor Aprova (se etapa única)
    
    state PENDENTE_RH {
        [*] --> GERAR_IA_STEP2
        GERAR_IA_STEP2 --> NOTIFICAR_RH : Sucesso IA / Fallback
        NOTIFICAR_RH --> AGUARDANDO_DECISAO_RH
    }
    
    AGUARDANDO_DECISAO_RH --> REJEITADO : RH Rejeita
    AGUARDANDO_DECISAO_RH --> APROVADO : RH Aprova
    
    APROVADO --> [*] : Gravar Log Auditoria + Notificar Solicitante
    REJEITADO --> [*] : Gravar Log Auditoria + Notificar Solicitante
```

---

## 6. Diretrizes para Agentes de IA e Devs (Prompting & Codificação)

Ao converter este mockup/especificação em componentes reais (React/Next.js/Tailwind/shadcn):

1. **Respeitar os Rótulos dos Tokens:** Sempre referenciar CSS custom properties (`var(--paper)`, `var(--azul-900)`, `var(--amarelo-600)`) ou mapear no Tailwind `tailwind.config.js` sob a marca FluxoRH.
2. **Componente de Resumo por IA (`.callout-ia`):**
   - Nunca bloquear a renderização da tela se o resumo de IA estiver carregando ou falhar. Usar estado de fallback exibindo os dados brutos da solicitação se `resumo_ia == null`.
3. **Mecanismo de Carimbo (`.stamp-badge`):**
   - Manter a tipografia monospace (`IBM Plex Mono`), caixa alta e a rotação sutil (`transform: rotate(-1.4deg)`) para preservar a assinatura estética de "documento chancelado".
4. **Guarda de Acesso por Papel (RBAC):**
   - Garantir que a renderização condicional do menu e das telas valide explicitamente as permissões do papel ativo (`SOLICITANTE`, `GESTOR`, `RH_ADMIN`).
