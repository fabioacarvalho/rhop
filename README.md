# RHOP — RH Obra Prima

Plataforma de fluxos de aprovação de RH (Vaga, Férias, Reembolso) com IA gerando resumos por solicitação para agilizar decisões de aprovadores, e insights agregados por tipo de fluxo. Projeto de hackathon.

## O problema

Processos de RH como abertura de vaga, férias e reembolso dependem hoje de etapas manuais (solicitante → gestor → RH), sem notificação automática, cobrança de pendências ou visibilidade de status em tempo real — gerando atrasos recorrentes.

## A solução

- Solicitações percorrem etapas de aprovação configuráveis por tipo de fluxo.
- Cada aprovador recebe um **resumo gerado por IA** com o essencial da solicitação, decidindo em segundos.
- Status visível em tempo real para solicitante, gestor e RH (pendente, atrasado, aprovado, rejeitado).
- **Painel de Insights**: IA analisa padrões agregados por tipo de fluxo (ex: concentração de vagas por área).
- Log de auditoria + técnico para rastreabilidade completa.

Documentação completa: [`docs/2026-07-30-fluxorh-design.md`](./docs/2026-07-30-fluxorh-design.md).

## Stack

- [Next.js](https://nextjs.org/) (App Router, TypeScript) — frontend e backend
- [Prisma](https://www.prisma.io/) + PostgreSQL ([Supabase](https://supabase.com/))
- Supabase Auth (e-mail/senha)
- [OpenAI API](https://platform.openai.com/) (`gpt-4o-mini`)
- [Resend](https://resend.com/) para e-mail
- [Recharts](https://recharts.org/) para gráficos
- Deploy: [Vercel](https://vercel.com/)

## Papéis do sistema

| Papel | Visibilidade | Ações |
|---|---|---|
| `SOLICITANTE` | Próprias solicitações | Abrir solicitações |
| `GESTOR` | Próprias + da equipe | Aprovar/rejeitar da equipe |
| `RH_ADMIN` | Todas | Aprovar/rejeitar, configurar fluxos, ver auditoria |

## Como rodar localmente

### Pré-requisitos
- Node.js 20+
- Uma conta [Supabase](https://supabase.com/) (banco + auth)
- Uma API key da [OpenAI](https://platform.openai.com/api-keys)
- Uma API key do [Resend](https://resend.com/)

### Passo a passo

```bash
# instalar dependências
npm install

# copiar variáveis de ambiente
cp .env.example .env
# preencher .env com suas credenciais (ver seção abaixo)

# criar as tabelas no banco
npx prisma db push

# popular dados de teste (usuários + tipos de fluxo)
npx prisma db seed

# rodar em desenvolvimento
npm run dev
```

A aplicação sobe em `http://localhost:3000`.

### Variáveis de ambiente (`.env`)

```bash
DATABASE_URL=              # connection string do Supabase (Postgres)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
RESEND_API_KEY=
CRON_SECRET=                # token simples para proteger o endpoint de SLA
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` | Build de produção |
| `npx prisma studio` | Interface visual do banco |
| `npx prisma db push` | Sincroniza o schema com o banco |
| `npx prisma db seed` | Popula dados de teste |

## Estrutura do projeto

Ver detalhamento completo de pastas e arquitetura em camadas (Routes → Services → Prisma) no [`CLAUDE.md`](./CLAUDE.md).

```
app/            # páginas e API routes (Next.js App Router)
lib/services/   # lógica de negócio
lib/prisma.ts   # cliente Prisma
prisma/         # schema e seed
components/     # componentes de UI compartilhados
docs/           # especificação e plano de execução
```

## Documentação de apoio

- [Design completo](./docs/2026-07-30-fluxorh-design.md) — modelo de dados, telas, arquitetura, regras de negócio
- [`CLAUDE.md`](./CLAUDE.md) — convenções e regras de negócio para geração de código com IA

## Escopo do hackathon

Fora de escopo nesta versão: motor de workflow visual, múltiplos aprovadores em paralelo, upload de anexos, notificação via Slack/Teams, multi-empresa. Ver seção 10 do design doc.
