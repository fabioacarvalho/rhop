# RHOP — Contexto do Projeto (para Claude Code)

Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão. Mantém as decisões do design doc como regras de execução.

## O que é o projeto

Plataforma de fluxos de aprovação de RH (Vaga, Férias, Reembolso) com IA gerando resumos por solicitação e insights agregados por tipo de fluxo. Ver especificação completa em `docs/2026-07-30-fluxorh-design.md` — esse arquivo é a fonte da verdade para regras de negócio, modelo de dados e telas. Não reinterprete ou expanda o escopo definido lá sem confirmar antes.

## Stack

- Next.js (App Router) com API Routes — frontend e backend no mesmo projeto.
- Prisma + PostgreSQL (Supabase).
- Supabase Auth (e-mail/senha).
- OpenAI API (modelo `gpt-4o-mini`) — chamadas **somente** em código server-side (API routes/services), nunca no client.
- Resend para e-mail.
- Recharts para gráficos.
- Deploy: Vercel.

## Convenções de nomenclatura

- Entidades e campos do domínio ficam em **português**, exatamente como no design doc: `Solicitacao`, `TipoFluxo`, `Aprovacao`, `Log`, `dados`, `etapas`, `resumo_ia`, `prazo_sla`, etc. Não traduza para inglês — o objetivo é rastreabilidade 1:1 entre spec e código.
- Nomes de arquivo, funções e variáveis técnicas (ex: helpers genéricos, tipos de infraestrutura) podem ficar em inglês, seguindo convenção usual de Next.js/Prisma.

## Arquitetura do backend (obrigatório seguir)

Camadas simples, sem Clean Architecture completa:

```
app/api/**/route.ts     → Routes: validam entrada (Zod), checam auth, chamam service, retornam resposta. SEM lógica de negócio aqui.
lib/services/*.ts        → Services: lógica de negócio (ex: solicitacaoService, aprovacaoService, iaService, notificacaoService, insightsService, logService).
lib/prisma.ts             → Cliente Prisma singleton, único ponto de acesso ao banco.
```

Toda lógica de negócio nova entra em um service. Toda API route delega pro service correspondente e não acessa o Prisma diretamente.

## Regras de negócio que não podem ser violadas

- **Visibilidade:** solicitante só vê as próprias solicitações; gestor vê as próprias + as da equipe (usuários com `gestor_id` apontando para ele); RH_Admin vê tudo. Toda query de listagem precisa respeitar isso — nunca listar sem filtrar por papel do usuário autenticado.
- **Autorização de aprovação:** só quem é o aprovador da etapa atual (papel bate com `aprovador_role` da etapa e, se for GESTOR, é o gestor do solicitante) pode aprovar/rejeitar. Bloquear no backend, não só escondendo o botão no frontend.
- **IA nunca pode travar o fluxo:** se a chamada à OpenAI falhar (timeout, erro, rate limit), a solicitação segue seu curso normalmente sem `resumo_ia`, e o erro é gravado em `Log` (tipo `ERRO`). Nunca deixar uma falha de IA impedir a criação/avanço de uma `Solicitacao`.
- **Toda transição de status e toda decisão de aprovação grava um `Log` tipo `AUDITORIA`.** Toda falha de IA ou de notificação grava um `Log` tipo `ERRO`.

## O que está fora de escopo (não implementar sem confirmar)

- Motor de workflow visual (canvas). Configuração de etapas é via formulário/lista simples.
- Múltiplos aprovadores em paralelo na mesma etapa.
- Upload de arquivo (anexos). Usar campo de texto/link no lugar.
- Notificação via Slack/Teams. Só in-app + e-mail.
- Multi-tenant / múltiplas empresas.

## Como validar o trabalho

- Rodar `npm run build` e `npx prisma validate` antes de considerar uma tarefa concluída.
- Sempre que alterar lógica de autorização ou de fluxo de aprovação, descrever manualmente o cenário de teste no resumo da tarefa (ex: "testei como Gestor tentando aprovar solicitação de outra equipe → bloqueado corretamente").

## Regras

- Não adicione "Co-Authored-By:" nos seus commits, commit sempre com o meu usuario.
- Co-authored-by: Cursor;
- Use:

```
{
    "author": {
        "name": "Fábio Carvalho",
        "email": "ofabioalexcarvalho@gmail.com"
    }
}
```