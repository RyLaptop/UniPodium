# UniPodium — Handoff Document

**Purpose:** transfer full project context from one Claude conversation to another (e.g. moving from phone account to computer account). Paste the "Prompt to Resume" section below to a fresh Claude on the other account.

---

## Prompt to Resume (paste this to a fresh Claude)

```
I'm continuing work on a project called UniPodium. Read the attached
HANDOFF.md and PROGRESS.md, then unzip the attached codebase. We finished
Phase 7 (bulletin board + reminder cron + no-show tracking) — all 7
planned phases are now done. No Phase 8 is defined yet; help me figure out
what's next (deploy, domain, pilot orgs, etc.) or scope a new phase.
Follow the same protocol: break work into steps, save progress after each
step by updating PROGRESS.md, deliver a zip at the end of each phase.

Response style: casual, concise, no fluff, no affirmations. Just tell me
what I need to know. When you need me to pick something, use the
tappable options input (I'm often on mobile).
```

---

## Project overview

**UniPodium** is a cross-org campus communication platform for TAMU (Texas A&M University), designed to solve a specific pain point: members of one org wanting to speak at another org's meeting have to email/DM back and forth to arrange it. UniPodium turns that into a "click on the org, see their upcoming meetings, request a slot, chat with the directors" flow.

**Core features:**
1. Org directory + profiles
2. Meeting calendar per org
3. Request-to-speak flow (with pitch, requested time, approve/deny)
4. Realtime chat between speaker and directors after approval
5. Bulletin board on the front page for big campus events (admin-curated)
6. No-show tracking + speaker reputation (implicit via history)

**Distribution advantage:** the founder (Rylan) is a TAMU Student Senator and can onboard 20+ orgs to the pilot through his network.

---

## Naming journey (context if this comes up)

- Original name: **Podium** — killed due to trademark conflict with podium.com, a well-funded SaaS *customer communication platform* (exact same category as UniPodium). C&D risk on any traction.
- Second attempt: **HowdyBoard** — killed because "Howdy" collides with TAMU's official `howdy.tamu.edu` student portal and `howdyweek.tamu.edu`. TAMU's trademark office is active and would flag brand confusion.
- Current: **UniPodium** — riff on TAMU's "Yell Practice" tradition + the double meaning of "yelling" (announcing) about your event. Trademark risk assessed as real but lower than HowdyBoard because "Yell" alone isn't as directly tied to a TAMU web platform. Rylan emailed the TAMU trademark office to preempt any objection. **Assumption: proceed with UniPodium unless TAMU pushes back.**

---

## Stack decision

- **Next.js 15** (App Router, React 19, TypeScript)
- **Supabase** (Postgres, Auth, Realtime, Row Level Security)
- **Tailwind CSS**
- **Vercel** (deploy target)
- **Resend** (transactional email, Phase 7)

Chose this stack because Rylan already built another app (Freats — `freats.org`) on the same stack, so zero learning curve.

Domain: register `unipodium.app` or similar for ~$12 on Namecheap/Porkbun. Avoid `.com` for aftermarket price reasons; don't use `podium.*`.

---

## Architecture decisions

1. **7-table schema** — everything the MVP needs, no more. See `supabase/migrations/00001_initial_schema.sql`.
2. **RLS everywhere** — no service-role calls from the app; auth-scoped queries only. Two exceptions: `create_org()` RPC is `SECURITY DEFINER` to sidestep the chicken-and-egg problem where a user needs to be a director to add themselves as one; and the Phase 7 cron routes use a service-role client (`lib/supabase/service.ts`) since they run outside any user session and need to read/write across all orgs.
3. **Route group `(app)`** for authenticated pages so they share a nav layout without polluting URLs.
4. **Middleware** guards `/dashboard`, `/orgs`, `/meetings`, `/requests`, `/bulletin` and bounces signed-in users off `/login`.
5. **TAMU email allowlist** enforced in three places: client-side pattern, server action `signInWithEmail`, and again in `/auth/callback` (signs out non-allowed domains that somehow got a magic link).
6. **Realtime chat** uses Supabase Realtime channel per `speak_request_id`. Client-side inserts (RLS enforces write permission). Optimistic UI with rollback on error.
7. **Slot enforcement** — meetings have `slots_open` (integer). When approving a request, the server action counts existing approved+completed requests and rejects the approval if capacity is full.
8. **Cron** (Phase 7) — Next.js API routes under `/api/cron/*`, secured by a shared `CRON_SECRET`, hit by an external free pinger (cron-job.org) instead of Vercel Cron. Vercel Hobby cron only runs once a day, too coarse for 24h/1h reminders and prompt no-show marking.

---

## Data model summary

| Table | Purpose |
|---|---|
| `users` | Public profile mirror of `auth.users`. Auto-populated by trigger on signup. Has `is_site_admin` (Phase 7). |
| `orgs` | Each org's basic info (name, slug, description). |
| `org_members` | Membership + role: `member`, `officer`, `director`. |
| `meetings` | Individual meetings scheduled by an org. Has `slots_open`, `slot_length_minutes`. |
| `speak_requests` | A speaker's request to speak at a specific meeting. Status: `pending`, `approved`, `denied`, `completed`, `no_show`, `cancelled`. Has `reminder_24h_sent_at`/`reminder_1h_sent_at` (Phase 7). |
| `chat_messages` | Chat between speaker and target org officers/directors, scoped by `speak_request_id`. |
| `bulletin_posts` | Front-page event board submissions. Admin-curated (Phase 7). |

Helper function `has_org_role(org_id, min_role)` is used throughout RLS policies.

---

## Phase status

See `PROGRESS.md` in the zip for authoritative status. As of this handoff:

- ✅ Phase 1 — Project scaffold
- ✅ Phase 2 — Database schema (7 tables + RLS + realtime)
- ✅ Phase 3 — TAMU email auth + protected routes
- ✅ Phase 4 — Org directory + profiles + create/join
- ✅ Phase 5 — Meetings + request-to-speak flow
- ✅ Phase 6 — Realtime chat
- ✅ Phase 7 — Bulletin board + reminder cron + no-show cron

All 7 originally-planned phases are done. No Phase 8 is scoped yet.

---

## Setup instructions (for Rylan when at his computer)

1. Unzip
2. `cd unipodium && npm install`
3. Create a Supabase project at supabase.com
4. Copy `.env.example` → `.env.local` and fill in the Supabase URL, anon key, service role key
5. Run migrations in order — either via `supabase db push` after linking, or paste `supabase/migrations/00001_initial_schema.sql`, `00002_org_joins_and_creation.sql`, `00003_site_admin_and_bulletin_review.sql` into the SQL editor and run
6. In Supabase dashboard: Authentication → URL Configuration → Site URL = `http://localhost:3000`; add `http://localhost:3000/auth/callback` to Redirect URLs
7. `npm run db:types` to generate real types (replaces the placeholder in `lib/supabase/database.types.ts`)
8. In Supabase SQL editor: `update public.users set is_site_admin = true where email = 'you@tamu.edu';` (do this after signing in once, so your `public.users` row exists)
9. Get a Resend API key (resend.com, free) → `RESEND_API_KEY` in `.env.local`
10. Set `CRON_SECRET` in `.env.local` to any random string
11. `npm run dev`
12. Open http://localhost:3000, sign in with your @tamu.edu email, check for magic link email

**Once deployed to Vercel:** set up 2 free monitors at cron-job.org (or similar) hitting `/api/cron/reminders?secret=...` and `/api/cron/no-shows?secret=...` every 15–30 min. See PROGRESS.md Phase 7 section for exact URLs.

---

## Response style Rylan prefers

- Casual, direct, no fluff, no affirmations ("Great question!" etc.)
- Bare-bones — only what he needs to know
- Break work into phases, save progress after each so he can pick up where he left off if usage runs out
- Use tappable option inputs when asking him to pick something (he's often on mobile)
- Don't treat him like a kid; don't tell him to take breaks
- Honest feedback over hedged responses
- If a decision has real risk, flag it plainly (e.g. trademark issues, Vercel Hobby cron limits) rather than defaulting to caution

---

## Files in this handoff

- `HANDOFF.md` — this file
- `PROGRESS.md` — living phase tracker with file-by-file breakdown of what's built
- `unipodium-phase7.zip` — full codebase through Phase 7
