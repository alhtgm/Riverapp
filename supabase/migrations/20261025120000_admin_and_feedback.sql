-- ============================================================
-- 管理者画面と、開発者へのメッセージ
-- - 利用者は設定から開発者にメッセージ（バグ報告・要望・その他）を送れる
-- - 管理者は /admin でメッセージを読み、対応状況とメモを付け、返事を受信箱に届けられる
-- - 管理者は利用状況のまとめ・ユーザー一覧を見て、ユーザーの利用停止と全員へのお知らせができる
-- 管理者は admins 表に入っている人だけ。アプリからは追加できず、SQL で登録する:
--   insert into admins (user_id) select id from auth.users where email = '...';
-- ============================================================

-- ---- 管理者 ----
create table admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
-- 中身は is_admin() を通してだけ見る（ポリシーを作らないので利用者からは読み書きできない）
alter table admins enable row level security;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

grant execute on function is_admin() to authenticated;

-- 管理者向けの関数の最初に呼ぶ
create or replace function assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
end;
$$;

-- 1日に送れるメッセージの数
create or replace function limit_feedback_per_day() returns integer
  language sql immutable as $$ select 20 $$;

-- ---- 開発者へのメッセージ ----
create table feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  category    text not null check (category in ('bug', 'request', 'other')),
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  -- 送ったときの環境（アプリのバージョン・ブラウザ・画面の大きさなど）
  context     jsonb not null default '{}'::jsonb,
  status      text not null default 'open' check (status in ('open', 'in_progress', 'done')),
  admin_note  text check (char_length(admin_note) <= 2000),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index feedback_status_created_idx on feedback (status, created_at desc);
create index feedback_user_created_idx on feedback (user_id, created_at desc);

-- 読み書きは関数を通してだけ行う
alter table feedback enable row level security;

create table feedback_replies (
  id          uuid primary key default gen_random_uuid(),
  feedback_id uuid references feedback(id) on delete cascade not null,
  admin_id    uuid references auth.users(id) on delete set null,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz default now()
);

create index feedback_replies_feedback_idx on feedback_replies (feedback_id, created_at);
alter table feedback_replies enable row level security;

create or replace function submit_feedback(p_category text, p_body text, p_context jsonb default '{}'::jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if (select count(*) from feedback where user_id = auth.uid() and created_at > now() - interval '1 day') >= limit_feedback_per_day() then
    raise exception 'feedback limit reached' using errcode = 'P0001';
  end if;
  insert into feedback (user_id, category, body, context)
  values (auth.uid(), p_category, btrim(p_body), coalesce(p_context, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function submit_feedback(text, text, jsonb) to authenticated;

-- ---- 利用停止 ----
create table user_suspensions (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  reason       text check (char_length(reason) <= 500),
  suspended_by uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now()
);
alter table user_suspensions enable row level security;

-- ---- 全員へのお知らせ（送った履歴。届くのは notifications の 'announcement'） ----
create table announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(btrim(title)) between 1 and 100),
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  sent_by    uuid references auth.users(id) on delete set null,
  recipients integer not null default 0,
  created_at timestamptz default now()
);
alter table announcements enable row level security;

-- ============================================================
-- 管理者向けの関数（どれも最初に assert_admin() で確かめる）
-- ============================================================

-- 利用状況のまとめ
create or replace function admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform assert_admin();
  return jsonb_build_object(
    'users_total',        (select count(*) from profiles),
    'users_new_7d',       (select count(*) from profiles where created_at > now() - interval '7 days'),
    'users_active_7d',    (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'lectures_total',     (select count(*) from lectures where archived_at is null),
    'tasks_total',        (select count(*) from lecture_tasks where deleted_at is null),
    'tasks_new_7d',       (select count(*) from lecture_tasks where deleted_at is null and created_at > now() - interval '7 days'),
    'feedback_open',      (select count(*) from feedback where status = 'open'),
    'feedback_in_progress', (select count(*) from feedback where status = 'in_progress'),
    'users_suspended',    (select count(*) from user_suspensions)
  );
end;
$$;

-- メッセージの一覧（p_status が null ならすべて）
create or replace function admin_list_feedback(p_status text default null)
returns table (
  id uuid, user_id uuid, display_name text, handle text, category text, body text, context jsonb,
  status text, admin_note text, created_at timestamptz, updated_at timestamptz, reply_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform assert_admin();
  return query
    select f.id, f.user_id, p.display_name, p.handle, f.category, f.body, f.context,
           f.status, f.admin_note, f.created_at, f.updated_at,
           (select count(*) from feedback_replies r where r.feedback_id = f.id)
    from feedback f
    left join profiles p on p.id = f.user_id
    where p_status is null or f.status = p_status
    order by f.created_at desc
    limit 500;
end;
$$;

create or replace function admin_feedback_replies(p_feedback_id uuid)
returns table (id uuid, body text, admin_name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform assert_admin();
  return query
    select r.id, r.body, p.display_name, r.created_at
    from feedback_replies r
    left join profiles p on p.id = r.admin_id
    where r.feedback_id = p_feedback_id
    order by r.created_at;
end;
$$;

-- 対応状況とメモを変える
create or replace function admin_update_feedback(p_id uuid, p_status text, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform assert_admin();
  update feedback
     set status = p_status, admin_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'feedback not found' using errcode = 'P0002';
  end if;
end;
$$;

-- 返事を送る（送った人の受信箱に届く。未対応なら対応中にする）
create or replace function admin_reply_feedback(p_id uuid, p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_feedback feedback%rowtype;
begin
  perform assert_admin();
  select * into v_feedback from feedback where id = p_id;
  if not found then
    raise exception 'feedback not found' using errcode = 'P0002';
  end if;
  insert into feedback_replies (feedback_id, admin_id, body) values (p_id, auth.uid(), btrim(p_body));
  update feedback set status = 'in_progress', updated_at = now() where id = p_id and status = 'open';
  if v_feedback.user_id is not null then
    insert into notifications (user_id, type, payload)
    values (v_feedback.user_id, 'feedback_reply', jsonb_build_object(
      'feedback_id', p_id,
      'category', v_feedback.category,
      'original', left(v_feedback.body, 80),
      'body', btrim(p_body)
    ));
  end if;
end;
$$;

-- ユーザー一覧（表示名・ユーザーIDで探す。メールアドレスは出さない）
create or replace function admin_list_users(p_query text default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, display_name text, handle text, school_name text, created_at timestamptz,
  last_sign_in_at timestamptz, lecture_count bigint, feedback_count bigint,
  is_admin boolean, suspended_at timestamptz, suspended_reason text, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  perform assert_admin();
  return query
    select p.id, p.display_name, p.handle, s.name, p.created_at,
           u.last_sign_in_at,
           (select count(*) from lecture_participants lp where lp.user_id = p.id and lp.status = 'active'),
           (select count(*) from feedback f where f.user_id = p.id),
           exists (select 1 from admins a where a.user_id = p.id),
           us.created_at, us.reason,
           count(*) over ()
    from profiles p
    join auth.users u on u.id = p.id
    left join schools s on s.id = p.school_id
    left join user_suspensions us on us.user_id = p.id
    where v_q is null
       or p.display_name ilike '%' || v_q || '%'
       or p.handle ilike '%' || ltrim(v_q, '@') || '%'
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;

-- 利用停止・解除。停止するとログインできなくなり、ログイン中の端末も次の更新でログアウトされる
create or replace function admin_set_suspended(p_user_id uuid, p_suspended boolean, p_reason text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform assert_admin();
  if p_user_id = auth.uid() then
    raise exception 'cannot suspend yourself' using errcode = 'P0001';
  end if;
  if exists (select 1 from admins where user_id = p_user_id) then
    raise exception 'cannot suspend an admin' using errcode = 'P0001';
  end if;
  if p_suspended then
    insert into user_suspensions (user_id, reason, suspended_by)
    values (p_user_id, nullif(btrim(coalesce(p_reason, '')), ''), auth.uid())
    on conflict (user_id) do update set reason = excluded.reason, suspended_by = excluded.suspended_by, created_at = now();
    -- 'infinity' は認証サーバーが読めずにエラーになるので、十分先の日時にする
    update auth.users set banned_until = now() + interval '100 years' where id = p_user_id;
    delete from auth.sessions where user_id = p_user_id;
  else
    delete from user_suspensions where user_id = p_user_id;
    update auth.users set banned_until = null where id = p_user_id;
  end if;
end;
$$;

-- 全員へのお知らせ（利用停止中の人には送らない）。届けた人数を返す
create or replace function admin_send_announcement(p_title text, p_body text)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer;
begin
  perform assert_admin();
  insert into announcements (title, body, sent_by) values (btrim(p_title), btrim(p_body), auth.uid())
  returning id into v_id;
  insert into notifications (user_id, type, payload)
  select p.id, 'announcement', jsonb_build_object('announcement_id', v_id, 'title', btrim(p_title), 'body', btrim(p_body))
  from profiles p
  where not exists (select 1 from user_suspensions us where us.user_id = p.id);
  get diagnostics v_count = row_count;
  update announcements set recipients = v_count where id = v_id;
  return v_count;
end;
$$;

create or replace function admin_list_announcements()
returns table (id uuid, title text, body text, sender_name text, recipients integer, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform assert_admin();
  return query
    select a.id, a.title, a.body, p.display_name, a.recipients, a.created_at
    from announcements a
    left join profiles p on p.id = a.sent_by
    order by a.created_at desc
    limit 100;
end;
$$;

-- 管理者向けの関数はログインしている人にだけ公開する（中で管理者かどうかを確かめる）
revoke execute on function assert_admin() from public, anon, authenticated;
revoke execute on function admin_stats() from public, anon;
revoke execute on function admin_list_feedback(text) from public, anon;
revoke execute on function admin_feedback_replies(uuid) from public, anon;
revoke execute on function admin_update_feedback(uuid, text, text) from public, anon;
revoke execute on function admin_reply_feedback(uuid, text) from public, anon;
revoke execute on function admin_list_users(text, integer, integer) from public, anon;
revoke execute on function admin_set_suspended(uuid, boolean, text) from public, anon;
revoke execute on function admin_send_announcement(text, text) from public, anon;
revoke execute on function admin_list_announcements() from public, anon;
grant execute on function admin_stats() to authenticated;
grant execute on function admin_list_feedback(text) to authenticated;
grant execute on function admin_feedback_replies(uuid) to authenticated;
grant execute on function admin_update_feedback(uuid, text, text) to authenticated;
grant execute on function admin_reply_feedback(uuid, text) to authenticated;
grant execute on function admin_list_users(text, integer, integer) to authenticated;
grant execute on function admin_set_suspended(uuid, boolean, text) to authenticated;
grant execute on function admin_send_announcement(text, text) to authenticated;
grant execute on function admin_list_announcements() to authenticated;
