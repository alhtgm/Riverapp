-- ============================================================
-- フレンド・パーティー機能 (2/6): 講義・課題の共有モデル
-- subjects/tasks/recurrences を講義単位の共有モデルへ置き換える。
-- RLSポリシーは 20261008180300_permission_functions_and_rls.sql で定義する
-- （本マイグレーションでは enable row level security のみ行い、既定で拒否にしておく）。
-- ============================================================

-- 講義名の表記ゆれ（全角/半角・空白・大文字小文字）を正規化する関数
create or replace function normalize_lecture_title(p_title text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(normalize(p_title, nfkc), '\s+', '', 'g'));
$$;

create table lectures (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  normalized_title text generated always as (normalize_lecture_title(title)) stored,
  year             integer not null check (year between 2000 and 2100),
  term             text not null check (term in ('spring', 'fall', 'full_year', 'other')),
  professor        text,
  visibility       text not null default 'party' check (visibility in ('party', 'friends', 'public')),
  apply_open       boolean not null default false,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz default now(),
  archived_at      timestamptz
);

create index lectures_similar_idx on lectures (normalized_title, year, term) where archived_at is null;
create index lectures_visibility_idx on lectures (visibility) where archived_at is null;

-- 公開範囲が「全体」の間は参加申請を常にオンにする
create or replace function enforce_lecture_apply_open()
returns trigger
language plpgsql
as $$
begin
  if new.visibility = 'public' then
    new.apply_open := true;
  end if;
  return new;
end;
$$;

create trigger lectures_enforce_apply_open
  before insert or update of visibility on lectures
  for each row execute function enforce_lecture_apply_open();

create table lecture_participants (
  lecture_id uuid references lectures(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  status     text not null default 'active' check (status in ('active', 'left', 'excluded')),
  color      text not null,
  "order"    integer not null default 0,
  joined_at  timestamptz default now(),
  left_at    timestamptz,
  created_at timestamptz default now(),
  primary key (lecture_id, user_id)
);

create index lecture_participants_user_idx on lecture_participants (user_id, status);
create index lecture_participants_lecture_idx on lecture_participants (lecture_id, status);

create table lecture_apply_requests (
  id            uuid primary key default gen_random_uuid(),
  lecture_id    uuid references lectures(id) on delete cascade not null,
  user_id       uuid references auth.users(id) on delete cascade not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  created_at    timestamptz default now(),
  responded_at  timestamptz,
  responded_by  uuid references auth.users(id) on delete set null,
  expires_at    timestamptz not null default (now() + limit_apply_request_ttl())
);

create unique index lecture_apply_requests_pending_idx
  on lecture_apply_requests (lecture_id, user_id) where status = 'pending';
create index lecture_apply_requests_lecture_idx on lecture_apply_requests (lecture_id, status);
create index lecture_apply_requests_user_idx on lecture_apply_requests (user_id, status);

-- 繰り返し課題のルール（講義単位・共有）
create table lecture_recurrences (
  id             uuid primary key default gen_random_uuid(),
  lecture_id     uuid references lectures(id) on delete cascade not null,
  title          text not null,
  start_from     date not null,
  interval_weeks integer not null default 1,
  duration_days  integer not null,
  count          integer not null,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz default now()
);

create index lecture_recurrences_lecture_idx on lecture_recurrences (lecture_id);

-- 課題の共有項目
create table lecture_tasks (
  id            uuid primary key default gen_random_uuid(),
  lecture_id    uuid references lectures(id) on delete cascade not null,
  recurrence_id uuid references lecture_recurrences(id) on delete set null,
  title         text not null,
  due_date      date not null,
  due_time      text,
  description   text,
  url           text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  deleted_at    timestamptz,
  deleted_by    uuid references auth.users(id) on delete set null
);

create index lecture_tasks_lecture_idx on lecture_tasks (lecture_id, deleted_at);
create index lecture_tasks_due_idx on lecture_tasks (lecture_id, due_date);
create index lecture_tasks_recurrence_idx on lecture_tasks (recurrence_id);

-- 課題の個人項目（進捗・作業予定期間・メモ・表示行）
create table task_user_state (
  task_id        uuid references lecture_tasks(id) on delete cascade not null,
  user_id        uuid references auth.users(id) on delete cascade not null,
  status         text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'submitted')),
  work_start_date date,
  work_end_date   date,
  memo            text,
  row_id          uuid,
  updated_at      timestamptz default now(),
  primary key (task_id, user_id)
);

create index task_user_state_user_idx on task_user_state (user_id, status);

alter table lectures enable row level security;
alter table lecture_participants enable row level security;
alter table lecture_apply_requests enable row level security;
alter table lecture_recurrences enable row level security;
alter table lecture_tasks enable row level security;
alter table task_user_state enable row level security;
