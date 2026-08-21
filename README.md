# UniPodium

Cross-org campus platform for meeting speakers, event calendars, and bulletin boards.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Supabase (Postgres, Auth, Realtime, RLS)
- Tailwind CSS
- Vercel (deploy)

## Setup

### 1. Install

```bash
cd unipodium
npm install
```

### 2. Create Supabase project

- Go to [supabase.com](https://supabase.com) → new project
- In Project Settings → API, copy: URL, anon key, service role key
- Copy `.env.example` to `.env.local` and fill values

### 3. Run the schema

Option A — Supabase CLI (recommended):
```bash
npx supabase login
npx supabase link --project-ref YOUR_REF
npx supabase db push
```

Option B — paste `supabase/migrations/00001_initial_schema.sql` into the Supabase SQL editor and run.

### 4. Configure auth

In Supabase dashboard → Authentication → Providers → Email:
- Enable magic link
- (Later) Add TAMU email domain restriction in code — already stubbed in `lib/supabase/middleware.ts`

### 5. Generate types

```bash
npm run db:types
```

### 6. Dev

```bash
npm run dev
```

Open http://localhost:3000.

## Roadmap

See `PROGRESS.md` for phase status.
