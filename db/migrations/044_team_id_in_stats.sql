alter table player_game_stats add column if not exists team_id uuid references teams(id) on delete set null;
