# Basket Bos — System Architecture

**Version:** 1.0 (Milestone 0)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Client (mobile-first, runs in LINE in-app browser / LIFF)  │
│  Next.js App Router · React · TypeScript · Tailwind CSS     │
└──────────────┬──────────────────────────────────────────────┘
               │ Server Actions / Route Handlers (REST)
┌──────────────▼──────────────────────────────────────────────┐
│  Next.js Server (Vercel)                                    │
│  · Auth callback (LINE OIDC → Supabase session)             │
│  · Service layer (business logic)                           │
│  · PromptPay QR payload generator (EMVCo)                   │
│  · Webhook receiver (LINE Messaging API — Phase 2)          │
└───────┬───────────────────────┬─────────────────────────────┘
        │                       │
┌───────▼────────────┐  ┌───────▼──────────────────────────────┐
│  Supabase          │  │  External services                   │
│  · Postgres + RLS  │  │  · LINE Login (OIDC)                 │
│  · Auth (sessions) │  │  · LINE Messaging API (push, P2)     │
│  · Storage (video, │  │  · AI Worker (P3): Python + YOLO /   │
│    avatars, slips) │  │    Roboflow / OpenCV / OpenAI API    │
│  · Realtime (queue │  │    on GPU cloud (Modal/RunPod)       │
│    live updates)   │  └──────────────────────────────────────┘
│  · Edge Functions  │
└────────────────────┘
```

## 2. Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Rendering | Next.js App Router, Server Components by default | Fast on 4G, minimal client JS |
| Mutations | **Server Actions** for app UI; REST Route Handlers only for webhooks & future mobile/AI clients | One codebase, type-safe end-to-end |
| Auth | LINE Login (OIDC) → verify `id_token` server-side → upsert user → mint Supabase session | Users already have LINE; zero signup friction |
| DB access | Supabase JS client with RLS + service-role client only inside server services | Defense in depth |
| FCFS correctness | Postgres function (`register_player`) with row locking — never client-side counting | Race-safe queue |
| Realtime | Supabase Realtime on `registrations`, `payments` | Live queue & paid/unpaid board |
| QR payment | `promptpay-qr` payload generation server-side, rendered as QR client-side | Free, offline, no bank API |
| AI pipeline | Event-sourced: AI writes `ai_events`, humans verify, verified events aggregate into `player_game_stats` | Add AI later with **zero schema change** |

## 3. Authentication Flow (LINE → Supabase)

```
1. User taps "Login with LINE"
2. Redirect to LINE OAuth (scope: profile, openid)
3. Callback route handler:
   a. Exchange code → id_token, access_token
   b. Verify id_token (LINE JWKS)
   c. Upsert `profiles` row keyed by line_user_id (service role)
   d. Create Supabase session for that user (admin API)
   e. Set session cookies → redirect to /onboarding or /dashboard
4. Middleware refreshes session; role read from profiles (server-side)
```

New users are routed to the onboarding wizard (profile required fields) before accessing games.

## 4. Service Layer (Clean Architecture, feature-based)

Each feature exposes a **service** (pure business logic, unit-testable), consumed by Server Actions (mutations) and Server Components (queries):

```
UI (RSC/Client) → Server Action → Service → Repository (Supabase) → Postgres
```

Services: `authService`, `profileService`, `gameService`, `registrationService`, `teamGeneratorService`, `paymentService`, `statsService`, `videoService`, `notificationService`, `aiAnalysisService`.

### Critical logic placement

- **registrationService.join / cancel** → delegates to Postgres functions `register_player(game_id)` and `cancel_registration(...)` (SECURITY DEFINER, row-locked) so FCFS + waitlist promotion is atomic even under concurrent taps.
- **teamGeneratorService** → pure TypeScript (deterministic given seed): composite score = weighted(skill, height, weight, win_rate, attendance); snake draft per position group; hill-climb swaps to minimize variance.
- **paymentService.generateQr** → builds EMVCo PromptPay payload (admin PromptPay ID + per-player amount).

## 5. API Design

### Server Actions (primary — app UI)

| Feature | Actions |
|---|---|
| profile | `updateProfile`, `completeOnboarding` |
| game | `createGame`, `updateGame`, `cancelGame`, `deleteGame` |
| registration | `joinGame`, `cancelRegistration`, `adminAddPlayer`, `adminRemovePlayer` |
| team | `generateTeams`, `swapPlayers`, `lockTeams` |
| payment | `markAsPaid`, `confirmPayment`, `waivePayment`, `remindUnpaid` |
| stats | `saveGameStats`, `setMvp` |
| video | `createUploadUrl`, `finalizeUpload`, `requestAnalysis` |

### REST Route Handlers (webhooks + machine clients)

```
POST /api/webhooks/line          LINE Messaging API events (P2)
POST /api/ai/jobs/:id/events     AI worker posts detected events (P3, service token)
POST /api/ai/jobs/:id/status     AI worker status updates (P3)
GET  /api/games/:id/export       Stats export (CSV) 
```

All inputs validated with **Zod** schemas shared between client and server. Errors returned as typed `Result<T, AppError>`; UI maps error codes to Thai messages.

## 6. Folder Structure (production, feature-based)

```
basket-bos/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── auth/callback/route.ts        # LINE OIDC callback
│   ├── (app)/                            # authenticated shell
│   │   ├── layout.tsx                    # nav, session guard
│   │   ├── dashboard/page.tsx
│   │   ├── games/
│   │   │   ├── page.tsx                  # list
│   │   │   └── [gameId]/
│   │   │       ├── page.tsx              # detail + queue
│   │   │       ├── teams/page.tsx
│   │   │       ├── payments/page.tsx
│   │   │       └── stats/page.tsx
│   │   ├── players/[playerId]/page.tsx   # public stat profile
│   │   ├── profile/page.tsx
│   │   ├── videos/…
│   │   ├── leaderboard/page.tsx
│   │   └── admin/…                       # admin-only screens
│   ├── onboarding/page.tsx
│   ├── api/                              # route handlers (webhooks, AI, export)
│   ├── layout.tsx  · globals.css
├── features/                             # ← business logic lives here
│   ├── auth/        {actions,services,types}
│   ├── profile/     {actions,services,components,types,schemas}
│   ├── games/       {actions,services,components,types,schemas}
│   ├── registration/{actions,services,components,types}
│   ├── teams/       {actions,services,lib/balancer.ts,components}
│   ├── payments/    {actions,services,lib/promptpay.ts,components}
│   ├── stats/       {actions,services,lib/ratings.ts,components}
│   ├── videos/      {actions,services,components}
│   ├── ai/          {services,types}     # job orchestration, event verification
│   └── notifications/{services,components}
├── components/
│   ├── ui/                               # Button, Card, Dialog, Badge, Skeleton…
│   ├── charts/
│   └── layout/
├── lib/
│   ├── supabase/  {client.ts,server.ts,admin.ts,middleware.ts}
│   ├── line/      {oauth.ts,messaging.ts}
│   ├── utils.ts · errors.ts · result.ts · constants.ts
├── db/
│   ├── migrations/                       # SQL migrations (supabase db)
│   └── seed.sql
├── types/database.ts                     # generated from Supabase
├── middleware.ts
├── .env.example
└── config files (tsconfig, tailwind, eslint, prettier)
```

Conventions: every list screen ships loading (Skeleton), empty, and error states; all env vars typed and validated at boot in `lib/env.ts`.

## 7. Future AI Integration (designed now, built later)

```
Video (Storage) → ai_analysis_jobs (queued)
   → GPU worker pulls job (signed URL)
   → Detection: players (YOLO11), ball, hoop · Tracking: ByteTrack · Jersey/court mapping
   → Emits ai_events (type, t_ms, player?, confidence, bbox jsonb)
   → Human verification UI (accept / reassign / reject)
   → Verified events aggregated → player_game_stats (source='ai'|'hybrid')
```

Because stats are **event-sourced with source & confidence**, swapping manual entry for AI (or OpenAI-assisted event classification) requires no changes to profiles, dashboards, or leaderboards.

## 8. Environments & Ops

- `dev` (local + Supabase branch) → `production` (Vercel + Supabase project)
- Secrets via env vars only: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LINE_CHANNEL_ID/SECRET`, `LINE_MESSAGING_TOKEN`, `PROMPTPAY_ID`, `AI_WORKER_TOKEN`
- CI: typecheck, lint, unit tests (services), migration check
