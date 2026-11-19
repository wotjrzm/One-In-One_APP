create table users (
  id uuid primary key default gen_random_uuid(),
  github_id bigint unique not null, login text not null, avatar_url text not null,
  token_enc text not null, repo_name text, repo_status text not null default 'none'
    check (repo_status in ('none','ok','disconnected')),
  hide_from_ranking boolean not null default false, created_at timestamptz not null default now());
create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date_kst date not null, type text not null, problem_id text not null,
  is_correct boolean not null, payload jsonb not null,
  commit_status text not null default 'pending' check (commit_status in ('pending','committed')),
  commit_sha text, created_at timestamptz not null default now());
create unique index one_correct_per_day on attempts(user_id, date_kst, type) where is_correct;
create index attempts_user_date on attempts(user_id, date_kst);
-- RLS 활성화, 정책 없음: anon/authenticated 접근은 모두 차단, service role만 접근 (RLS 우회)
alter table users enable row level security;
alter table attempts enable row level security;
