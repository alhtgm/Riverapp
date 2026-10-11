-- ============================================================
-- 公開範囲の見直し（2026-10 仕様変更）
--   - 「パーティー内」は、参加者が選んだパーティーのメンバーだけに見せる
--     （参加者の誰かと同じパーティーなら誰でも、ではない）。
--   - 「フレンドまで」は、選んだパーティーのメンバー ＋ 参加者のいずれかのフレンド。
--   - 新たに「公開しない」(private) を追加。参加者だけが見える。
--   - 進捗の相互確認で、未着手を含むすべてのステータスの人を返す。
-- ============================================================

alter table lectures drop constraint if exists lectures_visibility_check;
alter table lectures
  add constraint lectures_visibility_check check (visibility in ('private', 'party', 'friends', 'public'));

-- 講義を見せるパーティー
create table lecture_visible_parties (
  lecture_id uuid references lectures(id) on delete cascade not null,
  party_id   uuid references parties(id) on delete cascade not null,
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  primary key (lecture_id, party_id)
);

create index lecture_visible_parties_party_idx on lecture_visible_parties (party_id);

alter table lecture_visible_parties enable row level security;

-- 参加者は、どのパーティーに見せているかを確認できる（名前は parties の RLS により
-- 自分が所属するパーティーのものだけが読める）。追加・削除は RPC 経由のみ。
create policy "Participants read visible parties"
  on lecture_visible_parties for select to authenticated
  using (is_active_lecture_participant(lecture_id, auth.uid()));

-- ------------------------------------------------------------
-- 閲覧可否の判定
-- ------------------------------------------------------------
create or replace function can_view_lecture(p_lecture_id uuid, p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_visibility text;
  v_archived_at timestamptz;
begin
  if p_user_id is null then
    return false;
  end if;

  select visibility, archived_at into v_visibility, v_archived_at
    from lectures where id = p_lecture_id;
  if v_visibility is null or v_archived_at is not null then
    return false;
  end if;

  -- 参加者自身は常に見える
  if exists(
    select 1 from lecture_participants
    where lecture_id = p_lecture_id and user_id = p_user_id and status = 'active'
  ) then
    return true;
  end if;

  if v_visibility = 'private' then
    return false;
  end if;

  -- ブロック関係は公開範囲より優先する
  if lecture_has_blocked_participant(p_lecture_id, p_user_id) then
    return false;
  end if;

  if v_visibility = 'public' then
    return true;
  end if;

  -- 選ばれたパーティーのメンバー（'party' / 'friends' 共通）
  if exists(
    select 1 from lecture_visible_parties vp
    join party_members pm on pm.party_id = vp.party_id and pm.user_id = p_user_id and pm.status = 'active'
    join parties p on p.id = vp.party_id and p.archived_at is null
    where vp.lecture_id = p_lecture_id
  ) then
    return true;
  end if;

  if v_visibility = 'friends' then
    return exists(
      select 1 from lecture_participants lp
      where lp.lecture_id = p_lecture_id and lp.status = 'active'
        and are_friends(p_user_id, lp.user_id)
    );
  end if;

  return false;
end;
$$;

-- ------------------------------------------------------------
-- 見せるパーティーの追加・削除（参加者なら誰でも。ただし自分が所属するパーティーのみ）
-- ------------------------------------------------------------
create or replace function set_lecture_visible_party(p_lecture_id uuid, p_party_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_party_name text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not is_active_lecture_participant(p_lecture_id, auth.uid()) then
    raise exception 'not a participant';
  end if;
  if not is_active_party_member(p_party_id, auth.uid()) then
    raise exception 'not a member of this party';
  end if;

  select name into v_party_name from parties where id = p_party_id;

  if p_enabled then
    insert into lecture_visible_parties (lecture_id, party_id, added_by)
      values (p_lecture_id, p_party_id, auth.uid())
      on conflict do nothing;
    if found then
      insert into activity_log (target_type, target_id, action, actor_id, after)
        values ('lecture', p_lecture_id, 'visible_party_add', auth.uid(),
          jsonb_build_object('party_id', p_party_id, 'party_name', v_party_name));
    end if;
  else
    delete from lecture_visible_parties where lecture_id = p_lecture_id and party_id = p_party_id;
    if found then
      insert into activity_log (target_type, target_id, action, actor_id, before)
        values ('lecture', p_lecture_id, 'visible_party_remove', auth.uid(),
          jsonb_build_object('party_id', p_party_id, 'party_name', v_party_name));
    end if;
  end if;
end;
$$;

grant execute on function set_lecture_visible_party(uuid, uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- 講義の作成: 「パーティー内」で作るときは、見せるパーティーを指定できる
-- （未指定なら自分が所属するすべてのパーティー）
-- ------------------------------------------------------------
drop function if exists create_lecture(text, integer, text, text, text, text);

create or replace function create_lecture(
  p_title text,
  p_year integer,
  p_term text,
  p_professor text default null,
  p_visibility text default 'party',
  p_color text default '#0891B2',
  p_party_ids uuid[] default null
)
returns lectures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lecture lectures;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into lectures (title, year, term, professor, visibility, created_by)
  values (trim(p_title), p_year, p_term, nullif(trim(p_professor), ''), coalesce(p_visibility, 'party'), auth.uid())
  returning * into v_lecture;

  insert into lecture_participants (lecture_id, user_id, status, color, "order")
  values (v_lecture.id, auth.uid(), 'active', p_color, 0);

  insert into lecture_visible_parties (lecture_id, party_id, added_by)
  select v_lecture.id, pm.party_id, auth.uid()
  from party_members pm
  join parties p on p.id = pm.party_id and p.archived_at is null
  where pm.user_id = auth.uid() and pm.status = 'active'
    and (p_party_ids is null or pm.party_id = any(p_party_ids));

  insert into activity_log (target_type, target_id, action, actor_id, after)
  values ('lecture', v_lecture.id, 'create', auth.uid(), to_jsonb(v_lecture));

  return v_lecture;
end;
$$;

grant execute on function create_lecture(text, integer, text, text, text, text, uuid[]) to authenticated;

-- ------------------------------------------------------------
-- パーティーのホーム画面: メンバーが参加している講義のうち、
-- このパーティーに見せている講義・フレンドまで・全体の講義で、自分から見えるもの
-- （公開しない講義や、別のパーティーにだけ見せている講義は出さない）
-- ------------------------------------------------------------
create or replace function get_party_lectures(p_party_id uuid)
returns table (
  id uuid, title text, year integer, term text, professor text, visibility text,
  apply_open boolean, participant_count integer, party_member_count integer, my_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from lecture_summaries(
    array(
      select distinct lp.lecture_id
      from lecture_participants lp
      join party_members pm on pm.user_id = lp.user_id and pm.party_id = p_party_id and pm.status = 'active'
      join lectures l on l.id = lp.lecture_id
      where lp.status = 'active'
        and (
          l.visibility in ('friends', 'public')
          or exists(select 1 from lecture_visible_parties vp where vp.lecture_id = l.id and vp.party_id = p_party_id)
        )
    ),
    p_party_id
  ) s
  where is_active_party_member(p_party_id, auth.uid());
$$;

-- ------------------------------------------------------------
-- 進捗: 未着手を含むすべてのステータスを返す（名前は参加者にだけ返す）
-- ------------------------------------------------------------
create or replace function get_lectures_progress(p_lecture_ids uuid[])
returns table (lecture_id uuid, task_id uuid, status text, user_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.lecture_id,
    s.task_id,
    s.status,
    case when is_active_lecture_participant(t.lecture_id, auth.uid())
              and (s.user_id = auth.uid() or not is_blocked(auth.uid(), s.user_id))
         then s.user_id end,
    case when is_active_lecture_participant(t.lecture_id, auth.uid())
              and (s.user_id = auth.uid() or not is_blocked(auth.uid(), s.user_id))
         then p.display_name end
  from lecture_tasks t
  join task_user_state s on s.task_id = t.id
  join lecture_participants lp on lp.lecture_id = t.lecture_id and lp.user_id = s.user_id and lp.status = 'active'
  left join profiles p on p.id = s.user_id
  where t.lecture_id = any(p_lecture_ids)
    and t.deleted_at is null
    and can_view_lecture(t.lecture_id, auth.uid());
$$;
