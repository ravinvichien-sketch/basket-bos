/**
 * Hand-written types for M1 tables.
 * After connecting your Supabase project, replace with generated types:
 *   npx supabase gen types typescript --project-id YOUR_ID > types/database.ts
 */

export type UserRole = "admin" | "player";
export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export type DominantHand = "left" | "right" | "both";
export type GameStatus =
  | "draft"
  | "open"
  | "closed"
  | "in_progress"
  | "completed"
  | "cancelled";
export type RegStatus = "confirmed" | "waitlisted" | "tentative" | "cancelled";
export type PayStatus = "unpaid" | "pending" | "paid" | "waived";
export type FeeMode = "split" | "fixed";

export interface Profile {
  id: string;
  line_user_id: string;
  role: UserRole;
  nickname: string;
  real_name: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  birth_year: number | null;
  dominant_hand: DominantHand;
  skill_rating: number;
  avatar_url: string | null;
  bio: string | null;
  onboarded: boolean;
  lang: "th" | "en";
  is_guest: boolean;
  is_group_admin: boolean;
  promptpay_id: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerPosition {
  profile_id: string;
  position: Position;
  priority: number;
}

export interface Group {
  id: string;
  name: string;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  profile_id: string;
  role: UserRole;
}

export interface Game {
  id: string;
  group_id: string | null;
  created_by: string;
  title: string;
  location: string;
  starts_at: string;
  ends_at: string;
  fee_mode: FeeMode;
  court_fee_thb: number;
  max_players: number;
  reg_opens_at: string;
  reg_deadline: string;
  status: GameStatus;
  notes: string | null;
  collector_profile_id: string | null;
  acting_admin_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Registration {
  id: string;
  game_id: string;
  profile_id: string;
  status: RegStatus;
  registered_at: string;
  cancelled_at: string | null;
  promoted_at: string | null;
  added_by: string | null;
  ref_profile_id: string | null;
  ref_approved: boolean;
  note: string | null;
}
