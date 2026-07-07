# Basket Bos — Development Roadmap & Milestones

**Version:** 1.0 · Each milestone ends with a working, reviewable increment. **Implementation of the next milestone starts only after your approval.**

---

## Milestone Overview

| # | Milestone | Deliverable you can test | Est. effort |
|---|---|---|---|
| M0 | **Planning** (this) | PRD, Architecture, DB design, Roadmap | ✅ done |
| M1 | Foundation & Auth | Login with LINE → onboarding wizard → profile stored | 3–5 days |
| M2 | Game Management | Admin creates/edits games; game list & detail pages | 2–3 days |
| M3 | Registration & Waitlist | One-tap join, FCFS order, auto-promotion, live queue | 3–4 days |
| M4 | Payments | PromptPay QR per player, paid/unpaid dashboard | 2–3 days |
| M5 | Team Generator | Balanced teams from confirmed list, regenerate/swap/lock | 2–3 days |
| M6 | Stats, Dashboard & Player Card | Courtside stat entry, player profiles, leaderboard, ratings, **shareable trading card** | 5–6 days |
| M7 | Video Module | Upload, link to game, playback, AI-ready job records | 2–3 days |
| M8 | LINE Notifications | Push: game open, promoted, payment reminder, teams ready | 2–3 days |
| M9 | Polish & Launch | Dark mode audit, empty/loading states, i18n, deploy to production | 2–3 days |
| M10+ | AI Stats (Phase 3) | Video → detected events → verification UI → auto stats | separate plan |

Total MVP (M1–M9): roughly **4–6 weeks** part-time.

---

## Milestone Details & Acceptance Criteria

### M1 — Foundation & Auth
Scaffold Next.js (App Router, TS, Tailwind), Supabase project + migration 001 (full schema from doc 03), RLS policies, LINE Login flow, session middleware, onboarding wizard (nickname, height, weight, age, positions, hand, skill, avatar), role system, base UI kit (dark mode).
**Accept when:** a new user logs in with LINE, completes onboarding, appears in DB with correct role; RLS blocks cross-user edits.

### M2 — Game Management
Admin CRUD for games with validation (deadline < start, fee ≥ 0), game lifecycle statuses, game list (upcoming/past) and detail page skeleton.
**Accept when:** admin creates a game and players see it; non-admins cannot mutate.

### M3 — Registration & Waitlist (core value)
`register_player` / `cancel_registration` Postgres functions, join/cancel UI with optimistic states, live queue via Realtime, waitlist auto-promotion + in-app notification, admin force add/remove.
**Accept when:** concurrent join test never overbooks; cancelling a confirmed slot promotes waitlist #1 within 1s, visibly live.

### M4 — Payments
Auto per-player share, PromptPay QR (EMVCo payload with amount), player "mark paid" + slip upload, admin confirm, per-game paid/unpaid dashboard, payment history.
**Accept when:** scanning the QR in a Thai bank app pre-fills the exact amount; dashboard reflects statuses in real time.

### M5 — Team Generator
Balancer (position coverage → snake draft → swap optimization), team cards UI, regenerate with seed, manual swap, lock.
**Accept when:** generated teams differ in composite score by < 5%; regenerate produces alternatives; lock freezes output.

### M6 — Stats, Dashboard & Player Card
Fast courtside stat-entry UI (tap +2/+3/AST/REB/…), MVP flag, season aggregates views, player profile page with rating tier, leaderboard, personal & admin dashboards with charts. **Shareable trading card**: tier-styled card design (bronze→silver→gold→holo), server-rendered share image (PNG) for LINE/IG, post-game MVP summary card pushed to group chat.
**Accept when:** a full game's stats entered in < 10 min; profile shows correct averages and rating; card image shares cleanly into a LINE chat.

### M7 — Video Module
Chunked upload to Storage, video ↔ game linkage, playback page, `ai_analysis_jobs` records created as `queued` (worker comes in Phase 3).
**Accept when:** a 2 GB video uploads reliably on mobile and plays back.

### M8 — LINE Notifications
LINE Messaging API integration, notification templates (Thai), webhook receiver, delivery tracking, user notification preferences.
**Accept when:** promotion from waitlist triggers a LINE push within seconds.

### M9 — Polish & Launch
i18n (th default/en), accessibility pass, empty/loading/error state audit, performance budget check, production deploy (Vercel + Supabase), seed real group data, onboarding of your actual players.

---

## Phase 3 Preview — AI Video Stats (M10+)

Separate detailed plan after MVP launch. Sequence: (1) shot-made detection on fixed camera (highest value, most tractable), (2) player tracking + jersey/color ID, (3) semi-auto event verification UI, (4) assists/steals/rebounds classification. Stack candidates: YOLO11 + ByteTrack on Modal/RunPod GPU, Roboflow for dataset labeling, OpenAI API for event summarization. Budget note: expect GPU cost ~฿5–15 per game video hour — priced into the AI subscription tier.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| LINE in-app browser quirks (cookies, uploads) | Test in LIFF browser from M1; fallback to external browser link |
| Race conditions in queue | DB-level locking (done in design), load test in M3 |
| Payment disputes | Slip upload + admin confirm + immutable history |
| AI accuracy expectations | Ship semi-auto (human verify) first; show confidence scores |
| Scope creep before launch | Approval gate per milestone; Phase 3 strictly after MVP |
