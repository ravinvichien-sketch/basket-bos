-- Add parent_id for threaded replies in profile comments
alter table profile_comments add column parent_id uuid references profile_comments(id) on delete cascade;

-- Index for efficient reply fetching
create index if not exists idx_profile_comments_parent_id on profile_comments(parent_id);
