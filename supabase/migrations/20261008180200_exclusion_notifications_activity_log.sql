-- ============================================================
-- フレンド・パーティー機能 (3/6): 除外投票・アプリ内通知・操作履歴
-- ============================================================

create table exclusion_votes (
  id             uuid primary key default gen_random_uuid(),
  target_type    text not null check (target_type in ('lecture', 'party')),
  target_id      uuid not null,
  target_user_id uuid references auth.users(id) on delete cascade not null,
  started_by     uuid references auth.users(id) on delete set null,
  status         text not null default 'open' check (status in ('open', 'passed', 'expired', 'cancelled')),
  created_at     timestamptz default now(),
  expires_at     timestamptz not null default (now() + limit_exclusion_vote_ttl()),
  resolved_at    timestamptz
);

-- 対象（講義 or パーティー）× 対象者につき、進行中の投票は同時に1件まで
create unique index exclusion_votes_open_idx
  on exclusion_votes (target_type, target_id, target_user_id) where status = 'open';
create index exclusion_votes_target_idx on exclusion_votes (target_type, target_id, status);

create table exclusion_vote_ballots (
  vote_id    uuid references exclusion_votes(id) on delete cascade not null,
  voter_id   uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (vote_id, voter_id)
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz default now()
);

create index notifications_user_unread_idx on notifications (user_id, read_at);
create index notifications_user_created_idx on notifications (user_id, created_at desc);

-- 汎用の操作履歴（講義・課題・パーティーの変更を記録）
create table activity_log (
  id         uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id   uuid not null,
  action      text not null,
  actor_id    uuid references auth.users(id) on delete set null,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz default now()
);

create index activity_log_target_idx on activity_log (target_type, target_id, created_at);

alter table exclusion_votes enable row level security;
alter table exclusion_vote_ballots enable row level security;
alter table notifications enable row level security;
alter table activity_log enable row level security;

-- notifications は本人のみ（他テーブルに依存しないので先に定義してよい）
create policy "Read own notifications"
  on notifications for select to authenticated
  using (user_id = auth.uid());

create policy "Mark own notifications read"
  on notifications for update to authenticated
  using (user_id = auth.uid());

-- exclusion_votes / exclusion_vote_ballots / activity_log の閲覧ポリシーは
-- can_view_lecture 等のヘルパー関数に依存するため
-- 20261008180300_permission_functions_and_rls.sql で定義する。
