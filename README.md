# Indecult Admin

Monorepo do painel administrativo da plataforma Indecult.

## Stack

- `Turborepo`
- `Next.js`
- `Supabase Auth`
- `Supabase Postgres`
- `Supabase Edge Functions`

## Estrutura

```text
apps/web
packages/ui
packages/supabase
supabase/migrations
supabase/functions
```

## Variaveis de ambiente

Use `.env.example` como referencia:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Primeiros passos

1. Instale as dependencias com `npm install`
2. Preencha o `.env.local`
3. Rode `npm run dev`

## Observacoes

- A pasta `supabase/` foi trazida do `indecult-user-front` para manter migrations e edge functions no mesmo repositório do admin.
- A app `apps/web` ja nasce como base do painel administrativo, pronta para evoluir fluxos de aprovacao, eleicoes e auditoria.
