# UniPodium — Build Progress

## Phase status

- [x] **Phase 1** — Project scaffold (Next.js + Supabase config, folder structure)
- [x] **Phase 2** — Database schema (7 tables, RLS policies, triggers, realtime)
- [x] **Phase 3** — TAMU email auth + protected routes
- [x] **Phase 4** — Org directory + org profile pages
- [x] **Phase 5** — Meeting management + request-to-speak flow
- [x] **Phase 6** — Realtime chat (director ↔ requester)
- [x] **Phase 7** — Bulletin board + reminder cron + no-show tracking

## What's in the repo so far

### Phase 1 (scaffold)
- `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
- `.env.example` — all env vars needed
- `.gitignore`
- `app/layout.tsx`, `app/page.tsx`, `app/globals.css` — landing page
- `lib/supabase/client.ts` — browser Supabase client
- `lib/supabase/server.ts` — server component Supabase client
- `lib/supabase/middleware.ts` — session refresh + protected route guard
- `lib/supabase/database.types.ts` — placeholder types (regenerate after DB is live)
- `lib/utils.ts` — `cn()` helper
- `middleware.ts` — Next.js middleware wiring
- `README.md`

### Phase 2 (schema)
- `supabase/migrations/00001_initial_schema.sql` — full schema:
  - Enums: `org_role`, `request_status`, `bulletin_status`
  - Tables: `users`, `orgs`, `org_members`, `meetings`, `speak_requests`, `chat_messages`, `bulletin_posts`
  - Helper: `has_org_role(org_id, min_role)` — used by all RLS policies
  - Triggers: auto-create `public.users` on signup, `updated_at` timestamps
  - RLS policies for every table
  - Realtime enabled for `chat_messages` and `speak_requests`

### Phase 3 (auth)
- `lib/auth/allowed-domains.ts` — email domain allowlist helper (reads env)
- `app/auth/actions.ts` — server actions: `signInWithEmail`, `signOut`
- `app/auth/callback/route.ts` — magic link handler, exchanges code for session, blocks non-allowed domains
- `app/login/page.tsx` — magic link form (React 19 `useActionState`)
- `app/logout/route.ts` — POST/GET sign-out endpoint
- `app/(app)/layout.tsx` — authenticated layout with nav + user pill + sign-out
- `app/(app)/dashboard/page.tsx` — post-login home, lists user's orgs (empty state until Phase 4)
- `lib/supabase/middleware.ts` — added redirect for signed-in users away from /login

**Supabase dashboard config needed before this works:**
1. Auth → Providers → Email → enable magic link (default is on)
2. Auth → URL Configuration → Site URL: `http://localhost:3000` (add `https://unipodium.app` when you deploy)
3. Auth → URL Configuration → Redirect URLs: add `http://localhost:3000/auth/callback`

### Phase 4 (org directory + profiles)
- `supabase/migrations/00002_org_joins_and_creation.sql` — RUN THIS. Adds self-join RLS policy + `create_org()` RPC that atomically creates org + adds caller as director (sidesteps chicken-and-egg RLS)
- `app/(app)/orgs/actions.ts` — server actions: `createOrg`, `joinOrg`, `leaveOrg`
- `app/(app)/orgs/page.tsx` — org directory (server-rendered list + member counts)
- `app/(app)/orgs/_search.tsx` — client component for search/filter
- `app/(app)/orgs/new/page.tsx` — create-org form
- `app/(app)/orgs/[slug]/page.tsx` — org profile page
- `app/(app)/orgs/[slug]/_join-leave.tsx` — client join/leave button
- Nav link for Orgs enabled in `(app)/layout.tsx`

### Phase 5 (meetings + request-to-speak)
- `app/(app)/orgs/[slug]/meetings/actions.ts` — createMeeting, deleteMeeting
- `app/(app)/orgs/[slug]/meetings/new/page.tsx` — new meeting page (officer/director gate)
- `app/(app)/orgs/[slug]/meetings/new/_form.tsx` — client form
- `app/(app)/orgs/[slug]/meetings/[meetingId]/page.tsx` — meeting detail (agenda, approved speakers, request form, officer inbox)
- `app/(app)/orgs/[slug]/meetings/[meetingId]/_request-form.tsx` — request-to-speak form
- `app/(app)/orgs/[slug]/meetings/[meetingId]/_officer-list.tsx` — approve/deny inline
- `app/(app)/requests/actions.ts` — createSpeakRequest, decideRequest, cancelRequest, markCompleted, markNoShow
- `app/(app)/requests/page.tsx` — "My requests" + "Incoming" tabs
- `app/(app)/requests/[id]/page.tsx` — single request detail
- `app/(app)/requests/[id]/_actions.tsx` — action buttons (approve/deny/cancel/complete/no-show)
- Enabled: Requests nav link, "+ New meeting" button on org page, meeting cards link to detail

### Phase 6 (realtime chat)
- `app/(app)/requests/[id]/_chat.tsx` — chat panel: subscribes to `chat_messages` inserts via Supabase Realtime channel `chat:{requestId}`, sends via client-side insert (RLS enforces), optimistic UI with rollback on error, auto-scroll to newest, Enter to send (Shift+Enter for newline)
- `app/(app)/requests/[id]/page.tsx` — updated to fetch initial `chat_messages` server-side, resolve participant names (speaker + all officers/directors of the target org), pass to `<Chat />`
- Chat is only rendered for the speaker + officers/directors — RLS enforces server-side too

### Phase 7 (bulletin board + reminder cron + no-show cron)

Decision: cron uses Next.js API routes + an external free pinger (cron-job.org),
NOT Supabase Edge Functions or Vercel Cron. Reasoning: Vercel Hobby cron is
capped at 1 run/day — too coarse for 24h/1h reminders and timely no-show
marking. Everything below stays free: Vercel Hobby, Resend free tier
(3k emails/mo, 100/day), cron-job.org free tier all support this. No paid
upgrade needed unless the pilot outgrows Resend's 100/day cap.

- `supabase/migrations/00003_site_admin_and_bulletin_review.sql` — RUN THIS.
  Adds `is_site_admin` to `public.users`, RLS for admin bulletin read/update,
  `reminder_24h_sent_at`/`reminder_1h_sent_at` on `speak_requests`
- `app/(app)/bulletin/page.tsx` — approved posts, grouped by date
- `app/(app)/bulletin/submit/page.tsx` + `_form.tsx` — submission form (any signed-in user)
- `app/(app)/bulletin/admin/page.tsx` + `_review-queue.tsx` — pending queue, gated on `is_site_admin`
- `app/(app)/bulletin/actions.ts` — submitBulletinPost, reviewBulletinPost
- `(app)/layout.tsx` — Bulletin nav link enabled, Admin link shown only to site admins
- `lib/supabase/service.ts` — service-role client (bypasses RLS; cron-only, never import from client/user code)
- `lib/email/resend.ts`, `lib/email/templates.ts` — Resend client + reminder email template
- `lib/cron-auth.ts` — shared-secret check (`Authorization: Bearer <CRON_SECRET>` or `?secret=`)
- `app/api/cron/reminders/route.ts` — GET, sends 24h + 1h reminders, dedup via sent-at columns
- `app/api/cron/no-shows/route.ts` — GET, flips `approved` → `no_show` 30 min after meeting end
- `.env.example`: added `CRON_SECRET`, `RESEND_FROM_EMAIL`
- `package.json`: added `resend` dep

**Setup needed before Phase 7 works:**
1. Run migration `00003_site_admin_and_bulletin_review.sql`
2. In Supabase SQL editor: `update public.users set is_site_admin = true where email = 'you@tamu.edu';`
3. Get a Resend API key (resend.com, free) → `RESEND_API_KEY` in `.env.local`. Leave `RESEND_FROM_EMAIL` blank until you verify `unipodium.app` as a domain in Resend — it'll fall back to their shared sandbox sender.
4. Generate a random string for `CRON_SECRET` in `.env.local` and on Vercel's env vars
5. Deploy to Vercel, then set up 2 free monitors at cron-job.org (or similar) hitting, every 15–30 min:
   - `https://unipodium.app/api/cron/reminders?secret=YOUR_CRON_SECRET`
   - `https://unipodium.app/api/cron/no-shows?secret=YOUR_CRON_SECRET`

## Resume instructions

When you come back:
1. Tell Claude: "resume UniPodium Phase 8" (or whichever phase — no Phase 8 defined yet)
2. Claude will read this file and continue from the next unchecked box
3. After each phase, this file is updated + a new zip is generated

## Local dev checklist (do these once before Phase 3)
- [ ] `npm install`
- [ ] Create Supabase project, copy keys into `.env.local`
- [ ] Run migration `00001_initial_schema.sql`
- [ ] `npm run dev` and confirm landing page loads

## Notes
- Name: **UniPodium** (pending TAMU trademark office response — pivot if flagged)
- Stack matches Freats so you already know it
- Domain: register `unipodium.app` or `unipodium.com` for ~$12 on Namecheap/Porkbun
