# Basket Bos — Database Design

**Version:** 1.0 (Milestone 0) · PostgreSQL (Supabase) · All tables have RLS enabled.

---

## 1. ER Diagram

```mermaid
erDiagram
    profiles ||--o{ player_positions : has
    profiles ||--o{ registrations : makes
    profiles ||--o{ payments : owes
    profiles ||--o{ player_game_stats : records
    profiles ||--o{ team_members : "assigned to"
    profiles ||--o{ notifications : receives
    games ||--o{ registrations : has
    games ||--o{ teams : has
    games ||--o{ payments : bills
    games ||--o{ player_game_stats : produces
    games ||--o{ videos : recorded_in
    games ||--o{ matches : contains
    teams ||--o{ team_members : contains
    teams ||--o{ matches : plays
    videos ||--o{ ai_analysis_jobs : analyzed_by
    ai_analysis_jobs ||--o{ ai_events : emits
    ai_events }o--|| profiles : attributed_to
    player_game_stats }o--o| ai_analysis_jobs : derived_from

    profiles {
        uuid id PK "= auth.users.id"
        text line_user_id UK
        text role "admin|player"
        text nickname
        text real_name
        smallint height_cm
        smallint weight_kg
        smallint birth_year
        text dominant_hand "left|right|both"
        numeric skill_rating "1.0-10.0"
        text avatar_url
        text bio
        boolean onboarded
        timestamptz created_at
    }
    player_positions {
        uuid profile_id FK
        text position "PG|SG|SF|PF|C"
        smallint priority "1-3"
    }
    games {
        uuid id PK
        uuid created_by FK
        text title
        text location
        timestamptz starts_at
        timestamptz ends_at
        integer court_fee_thb
        smallint max_players
        timestamptz reg_opens_at
        timestamptz reg_deadline
        text status "draft|open|closed|in_progress|completed|cancelled"
        timestamptz deleted_at "soft delete"
    }
    registrations {
        uuid id PK
        uuid game_id FK
        uuid profile_id FK
        text status "confirmed|waitlisted|cancelled"
        timestamptz registered_at "FCFS key"
        timestamptz cancelled_at
        timestamptz promoted_at
        uuid added_by "null=self, admin id if forced"
    }
    teams {
        uuid id PK
        uuid game_id FK
        text name
        text color
        boolean locked
        integer seed "regen seed"
    }
    team_members {
        uuid team_id FK
        uuid profile_id FK
        text assigned_position
    }
    matches {
        uuid id PK
        uuid game_id FK
        uuid team_a FK
        uuid team_b FK
        smallint score_a
        smallint score_b
    }
    payments {
        uuid id PK
        uuid game_id FK
        uuid profile_id FK
        integer amount_thb
        text status "unpaid|pending|paid|waived"
        text qr_payload
        text slip_url
        timestamptz paid_at
        uuid confirmed_by FK
    }
    player_game_stats {
        uuid id PK
        uuid game_id FK
        uuid profile_id FK
        smallint minutes
        smallint points
        smallint fgm
        smallint fga
        smallint tpm
        smallint tpa
        smallint ftm
        smallint fta
        smallint assists
        smallint reb_off
        smallint reb_def
        smallint steals
        smallint blocks
        smallint turnovers
        smallint fouls
        boolean is_mvp
        text source "manual|ai|hybrid"
        numeric confidence
        uuid ai_job_id FK
    }
    videos {
        uuid id PK
        uuid game_id FK
        uuid uploaded_by FK
        text storage_path
        integer duration_s
        bigint size_bytes
        text status "uploaded|queued|processing|analyzed|failed"
    }
    ai_analysis_jobs {
        uuid id PK
        uuid video_id FK
        text model_version
        text status "queued|running|completed|failed"
        jsonb params
        text error
        timestamptz started_at
        timestamptz completed_at
    }
    ai_events {
        uuid id PK
        uuid job_id FK
        integer t_ms "timestamp in video"
        text event_type "shot_made|shot_missed|assist|rebound|steal|block|turnover|sub_in|sub_out"
        uuid profile_id FK "nullable until verified"
        numeric confidence
        jsonb payload "bbox, court coords, clip range"
        text verify_status "pending|accepted|reassigned|rejected"
        uuid verified_by FK
    }
    notifications {
        uuid id PK
        uuid profile_id FK
        text type "game_open|promoted|payment_due|teams_ready|stats_ready"
        text channel "in_app|line"
        jsonb payload
        text status "pending|sent|read|failed"
        timestamptz sent_at
    }
```

## 2. Key Constraints & Indexes

```sql
-- One registration per player per game
ALTER TABLE registrations ADD CONSTRAINT uq_reg UNIQUE (game_id, profile_id);

-- FCFS / waitlist ordering
CREATE INDEX idx_reg_order ON registrations (game_id, status, registered_at);

-- One stat line per player per game
ALTER TABLE player_game_stats ADD CONSTRAINT uq_stats UNIQUE (game_id, profile_id);

-- One payment per player per game
ALTER TABLE payments ADD CONSTRAINT uq_pay UNIQUE (game_id, profile_id);

-- Positions: max 3 per player
-- enforced by trigger + UNIQUE (profile_id, position), UNIQUE (profile_id, priority)
```

Derived values (FG%, PPG, waitlist position, attendance rate, win rate, overall rating) are **never stored** — computed in views:

- `v_waitlist` — waitlist position via `row_number() over (partition by game_id order by registered_at)`
- `v_player_season_stats` — aggregates per player (totals, averages, percentages)
- `v_player_rating` — NBA-2K-style overall + rank tier
- `v_game_payment_summary` — paid/pending/unpaid counts & sums

## 3. Concurrency-Safe Registration (core of the product)

```sql
CREATE OR REPLACE FUNCTION register_player(p_game_id uuid)
RETURNS registrations
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE g games; confirmed int; r registrations;
BEGIN
  SELECT * INTO g FROM games WHERE id = p_game_id FOR UPDATE;  -- serialize per game
  IF g.status <> 'open' OR now() > g.reg_deadline THEN
    RAISE EXCEPTION 'REG_CLOSED';
  END IF;
  SELECT count(*) INTO confirmed FROM registrations
    WHERE game_id = p_game_id AND status = 'confirmed';
  INSERT INTO registrations (game_id, profile_id, status, registered_at)
  VALUES (p_game_id, auth.uid(),
          CASE WHEN confirmed < g.max_players THEN 'confirmed' ELSE 'waitlisted' END,
          clock_timestamp())
  RETURNING * INTO r;
  RETURN r;
END $$;
```

`cancel_registration()` mirrors this: locks the game row, marks cancelled, promotes the earliest `waitlisted` row to `confirmed` (sets `promoted_at`), and inserts a `notifications` row — all in one transaction. Two players tapping simultaneously can never both take the last slot.

## 4. Row-Level Security (summary)

| Table | select | insert | update |
|---|---|---|---|
| profiles | all members | self (via auth) | self; role changes admin-only |
| games | all | admin | admin |
| registrations | all | via `register_player()` only | via functions only |
| teams / team_members / matches | all | admin | admin |
| payments | own + admin sees all | system (on confirm list) | player → `pending` (own); admin → `paid/waived` |
| player_game_stats | all | admin / stat-keeper | admin |
| videos | all | admin | admin |
| ai_analysis_jobs / ai_events | admin (+worker via service token) | worker | worker + admin verify |
| notifications | own | system | own (mark read) |

## 5. Multi-Group Readiness

Phase 1 runs single-group. A `groups` table + `group_id` FK on `games` (and membership table `group_members(group_id, profile_id, role)`) is included in migration 001 but UI-hidden, so going multi-tenant later is additive, not a rewrite.

## 6. Storage Buckets

| Bucket | Access | Content |
|---|---|---|
| `avatars` | public read, owner write | profile images |
| `slips` | admin + owner | payment slips |
| `videos` | authenticated read, admin write | game videos (signed URLs for AI worker) |
