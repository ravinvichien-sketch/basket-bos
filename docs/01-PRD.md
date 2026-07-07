# Basket Bos — Product Requirement Document (PRD)

**Version:** 1.0 (Milestone 0)
**Date:** 2026-07-05
**Product:** Basketball Community Management Web App
**Codename:** Basket Bos

---

## 1. Vision & Problem Statement

Casual basketball groups in Thailand organize games through LINE group chats. Every session, players "sign up" by typing their name in chat — first come, first served. This creates recurring pain:

- No reliable ordered sign-up list; disputes over who registered first
- No waitlist; when someone cancels, re-organizing is manual chaos
- Court fees collected by hand; organizer chases payments one by one
- Teams are picked ad hoc and often unbalanced
- Game videos are recorded but never turned into player statistics

**Basket Bos** replaces the chat-based workflow with a mobile-first web app that plugs into LINE (login + notifications), handles sign-ups, fair team generation, PromptPay fee collection, and NBA-style player statistics — with an architecture ready for AI video analysis.

## 2. Target Users

| Persona | Description | Primary needs |
|---|---|---|
| **Organizer (Admin)** | Runs the group, books the court, collects money | Create games, manage queue, collect fees, generate teams |
| **Player** | Regular or occasional member | Join fast, see queue position, pay easily, track personal stats |

Initial scale: 1 group of 20–60 members. Design must support multiple groups later (multi-tenant ready).

## 3. Core Value Proposition

1. **Zero-friction sign-up** — one tap in LINE, timestamped, fair
2. **Automatic waitlist** — cancel → next player promoted instantly, notified
3. **One-scan payment** — PromptPay QR with exact per-person amount + paid/unpaid dashboard
4. **Fair teams** — algorithmic balance by position, size, and skill
5. **NBA-style stats & ranking** — the retention hook and future subscription driver (AI video analysis)

## 4. Functional Requirements

### 4.1 Authentication (F-AUTH)

| ID | Requirement | Priority |
|---|---|---|
| F-AUTH-1 | Login with LINE (LINE Login OAuth 2.1 / OIDC) | P0 |
| F-AUTH-2 | First login auto-creates a user profile linked to LINE user ID | P0 |
| F-AUTH-3 | Roles: `admin`, `player`. First user / seeded user is admin; admin can promote others | P0 |
| F-AUTH-4 | Session persists; silent re-login inside LINE in-app browser (LIFF-compatible) | P1 |

### 4.2 Player Profile (F-PROF)

Required at first login (onboarding wizard), editable later:

| Field | Type | Notes |
|---|---|---|
| Nickname | text | Display name, required |
| Real name | text | Optional |
| Height | number (cm) | Required |
| Weight | number (kg) | Required |
| Age / birth year | number | Required |
| Preferred positions | multi-select: PG, SG, SF, PF, C | 1–3 ordered choices |
| Dominant hand | left / right / both | |
| Skill rating | 1–10 | Self-assessed at onboarding; later adjusted by admin & performance |
| Avatar | image | Default = LINE profile picture |
| Basketball history | text | Free-form |

### 4.3 Game Management (F-GAME) — Admin only

- Create / edit / delete (soft-delete) games
- Fields: title, date & time (start–end), location, court fee (total THB), max players, registration open time, registration deadline
- Game lifecycle: `draft → open → closed → in_progress → completed → cancelled`
- Recurring game templates (P2 — later)

### 4.4 Registration System (F-REG)

| ID | Requirement | Priority |
|---|---|---|
| F-REG-1 | Player joins with one tap; server timestamp decides order (FCFS) | P0 |
| F-REG-2 | When confirmed slots are full, further joins go to an ordered **waitlist** | P0 |
| F-REG-3 | Cancel anytime before deadline; after deadline requires admin | P0 |
| F-REG-4 | On cancellation, waitlist #1 is **auto-promoted** (atomic, race-safe) | P0 |
| F-REG-5 | Promotion triggers a notification (in-app now, LINE push later) | P1 |
| F-REG-6 | Live view: confirmed list + waitlist with positions, visible to all members | P0 |
| F-REG-7 | Admin can force-add / force-remove players | P1 |

### 4.5 Team Generator (F-TEAM)

- Input: confirmed players of a game; number of teams (2–4)
- Balancing factors with configurable weights: preferred position coverage, height, weight, skill rating, historical win rate, attendance rate
- Algorithm: snake draft on composite score + local-swap optimization to minimize inter-team variance
- Admin can regenerate (new random seed), lock teams, or manually swap players
- Output: named/colored teams displayed to everyone

### 4.6 Payment (F-PAY)

| ID | Requirement | Priority |
|---|---|---|
| F-PAY-1 | Per-player share auto-calculated: court fee ÷ confirmed players (admin can override per player) | P0 |
| F-PAY-2 | Generate **PromptPay QR** (EMVCo Thai QR standard) with exact amount per player, from admin's PromptPay ID | P0 |
| F-PAY-3 | Player marks "I paid" (+ optional slip upload); admin confirms | P0 |
| F-PAY-4 | Payment dashboard per game: paid / pending / unpaid, totals, one-tap nudge | P0 |
| F-PAY-5 | Payment history per player and per game | P1 |
| F-PAY-6 | Automatic slip verification via bank API (P2 — future) | P2 |

> Note: PromptPay QR generation is free and offline (no bank API needed). Confirmation is manual in Phase 1 — this is the pragmatic, zero-cost approach.

### 4.7 Dashboard (F-DASH)

Player home screen shows: upcoming games (with join state), personal attendance rate, games played, win/loss record, payment status alerts, personal stat summary (PPG, APG, RPG, FG%) and rank/badge. Admin additionally sees: registration fill rate, unpaid totals, quick actions.

### 4.8 Statistics Module (F-STAT)

Per player per game: minutes, points, FGM/FGA, 3PM/3PA, FTM/FTA, assists, rebounds (off/def), steals, blocks, turnovers, fouls, MVP flag.

- Entry modes: **manual courtside entry** (fast tap UI) now; **AI-generated** later — schema stores `source` (`manual` | `ai` | `hybrid`) and `confidence`
- Derived: FG%, 3P%, FT%, per-game averages, season totals, efficiency rating
- Leaderboards + NBA-2K-style overall rating and rank tiers (e.g., Rookie → All-Star → MVP)

**F-CARD — Shareable Player Card (Strava-style social loop):**

- Every player gets a collectible **basketball trading card**: avatar, nickname, positions, OVR rating, rank tier, season stat line, team badge — NBA-2K / Panini-inspired design
- Card upgrades visually with rank tier (bronze → silver → gold → holo) so progress is visible and braggable
- One-tap **share as image** to LINE chat / IG story (server-rendered PNG via OG image pipeline)
- Post-game auto-summary card ("MVP tonight — 21 pts, 7 reb") shareable to the group chat
- Goal: same social competition loop as Strava — stats → card → share → friends join → more games

### 4.9 Video Module (F-VIDEO)

- Admin uploads game videos (Supabase Storage; chunked upload; mp4/mov)
- Video linked to game; list + playback page
- Status pipeline: `uploaded → queued → processing → analyzed → failed`
- **Future AI pipeline** (architecture must support without schema change): Video → Player Detection → Ball Detection → Player Tracking → Shot Detection → Action Recognition → Statistics Generation. AI emits timestamped *events* with confidence; humans verify; verified events roll up into F-STAT records.

### 4.10 Notifications (F-NOTIF)

- In-app notification center (Phase 1)
- LINE Messaging API push (Phase 2): game opened, promoted from waitlist, payment reminder, teams announced, stats published
- Schema stores channel, template type, payload, delivery status from day one

## 5. Non-Functional Requirements

- **Mobile-first**: 90%+ usage from phones inside LINE browser; all screens designed at 390px first
- **Performance**: interactive < 2s on 4G; registration action round-trip < 500ms
- **Concurrency-safe**: FCFS ordering and waitlist promotion must be atomic (DB-level, not client-level)
- **Security**: Supabase RLS on every table; admin actions server-verified; no client-trusted role checks
- **i18n-ready**: Thai as default UI language, English switchable
- **Dark mode**: supported from day one (NBA/Apple/Notion-inspired visual language)
- **Accessibility**: WCAG AA contrast, 44px touch targets

## 6. Monetization (Roadmap)

| Tier | Price (draft) | Includes |
|---|---|---|
| Free | ฿0 | 1 group, queue + payment + manual stats |
| Team Pro | ~฿99–199/group/mo | Unlimited games, LINE push, team generator, full stat history, leaderboards |
| AI Stats | ~฿49–99/player/mo or per-video credit | AI video analysis, highlight clips, NBA-style profile card |

AI video analysis is the differentiating premium feature; queue/payment features drive free adoption and network effects.

## 7. Success Metrics (MVP)

- 100% of group sign-ups happen in-app within 4 weeks of launch
- Payment collection time per game < 24h (from ~1 week)
- ≥ 60% weekly active members
- Waitlist auto-promotion works with zero manual intervention

## 8. Out of Scope (Phase 1)

Real-money processing / escrow, multiple concurrent groups UI (schema supports it, UI later), native mobile apps, automated bank slip verification, live real-time AI analysis.
