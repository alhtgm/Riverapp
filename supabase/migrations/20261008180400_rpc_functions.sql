-- ============================================================
-- フレンド・パーティー機能 (5/6): RPC関数（SECURITY DEFINER / トランザクション）
--
-- 人数上限や複数テーブル更新を伴う操作はすべてここに集約する。
-- 競合対策:
--   - 講義・パーティー単位の人数上限 → 対象の lectures / parties 行を
--     `for update` でロックしてから集計・更新する。
--   - ユーザー単位の上限（所属パーティー数など） → 対象ユーザーIDに対する
--     pg_advisory_xact_lock でトランザクション内のみシリアライズする。
-- ============================================================

-- ------------------------------------------------------------
-- 講義
-- ------------------------------------------------------------

create or replace function create_lecture(
  p_title text,
  p_year integer,
  p_term text,
  p_professor text default null,
  p_visibility text default 'party',
  p_color text default '#0891B2'
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

  insert into activity_log (target_type, target_id, action, actor_id, after)
  values ('lecture', v_lecture.id, 'create', auth.uid(), to_jsonb(v_lecture));

  return v_lecture;
end;
$$;

grant execute on function create_lecture(text, integer, text, text, text, text) to authenticated;

-- 自分が閲覧できる講義のうち、年度・学期が同じで講義名が似ているものを提示する
create or replace function find_similar_lectures(p_title text, p_year integer, p_term text)
returns setof lectures
language sql
stable
security definer
set search_path = public
as $$
  select l.*
  from lectures l
  where l.archived_at is null
    and l.year = p_year
    and l.term = p_term
    and l.normalized_title = normalize_lecture_title(p_title)
    and can_view_lecture(l.id, auth.uid())
  order by l.created_at desc
  limit 10;
$$;

grant execute on function find_similar_lectures(text, integer, text) to authenticated;

-- 即時参加（申請オフの講義向け）。すでに参加/退出済みなら再アクティブ化する。
create or replace function join_lecture(p_lecture_id uuid, p_color text default '#0891B2')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lecture lectures;
  v_existing lecture_participants;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_lecture from lectures where id = p_lecture_id for update;
  if v_lecture is null or v_lecture.archived_at is not null then
    raise exception 'lecture not found';
  end if;
  if not can_view_lecture(p_lecture_id, auth.uid()) then
    raise exception 'not visible';
  end if;
  if v_lecture.apply_open then
    raise exception 'this lecture requires an application';
  end if;

  select * into v_existing from lecture_participants
    where lecture_id = p_lecture_id and user_id = auth.uid();
  if v_existing.user_id is not null and v_existing.status = 'active' then
    return; -- already a member
  end if;
  if v_existing.user_id is not null and v_existing.status = 'excluded' then
    raise exception 'excluded from this lecture';
  end if;

  select count(*) into v_count from lecture_participants
    where lecture_id = p_lecture_id and status = 'active';
  if v_count >= limit_lecture_max_participants() then
    raise exception 'lecture is full';
  end if;

  if v_existing.user_id is not null then
    update lecture_participants set status = 'active', joined_at = now(), left_at = null
      where lecture_id = p_lecture_id and user_id = auth.uid();
  else
    insert into lecture_participants (lecture_id, user_id, status, color, "order")
      values (p_lecture_id, auth.uid(), 'active', p_color,
        coalesce((select max("order") + 1 from lecture_participants where user_id = auth.uid()), 0));
  end if;

  insert into activity_log (target_type, target_id, action, actor_id)
    values ('lecture', p_lecture_id, 'join', auth.uid());
end;
$$;

grant execute on function join_lecture(uuid, text) to authenticated;

-- 参加申請（申請オンの講義向け）
create or replace function request_join_lecture(p_lecture_id uuid)
returns lecture_apply_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lecture lectures;
  v_existing lecture_participants;
  v_request lecture_apply_requests;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_lecture from lectures where id = p_lecture_id for update;
  if v_lecture is null or v_lecture.archived_at is not null then
    raise exception 'lecture not found';
  end if;
  if not can_view_lecture(p_lecture_id, auth.uid()) then
    raise exception 'not visible';
  end if;
  if not v_lecture.apply_open then
    raise exception 'this lecture does not require an application';
  end if;

  select * into v_existing from lecture_participants
    where lecture_id = p_lecture_id and user_id = auth.uid();
  if v_existing.user_id is not null and v_existing.status = 'active' then
    raise exception 'already a participant';
  end if;
  if v_existing.user_id is not null and v_existing.status = 'excluded' then
    raise exception 'excluded from this lecture';
  end if;
  if exists(select 1 from lecture_apply_requests where lecture_id = p_lecture_id and user_id = auth.uid() and status = 'pending') then
    raise exception 'request already pending';
  end if;

  insert into lecture_apply_requests (lecture_id, user_id)
    values (p_lecture_id, auth.uid())
    returning * into v_request;

  insert into activity_log (target_type, target_id, action, actor_id)
    values ('lecture', p_lecture_id, 'apply_request', auth.uid());

  return v_request;
end;
$$;

grant execute on function request_join_lecture(uuid) to authenticated;

-- 参加申請の承認/却下（参加者なら誰でも可）
create or replace function respond_join_request(p_request_id uuid, p_approve boolean, p_color text default '#0891B2')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request lecture_apply_requests;
  v_lecture lectures;
  v_count integer;
  v_existing lecture_participants;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_request from lecture_apply_requests where id = p_request_id for update;
  if v_request is null or v_request.status <> 'pending' then
    raise exception 'request not pending';
  end if;
  if not is_active_lecture_participant(v_request.lecture_id, auth.uid()) then
    raise exception 'not a participant of this lecture';
  end if;

  if p_approve then
    select * into v_lecture from lectures where id = v_request.lecture_id for update;
    select count(*) into v_count from lecture_participants
      where lecture_id = v_request.lecture_id and status = 'active';
    if v_count >= limit_lecture_max_participants() then
      raise exception 'lecture is full';
    end if;

    select * into v_existing from lecture_participants
      where lecture_id = v_request.lecture_id and user_id = v_request.user_id;
    if v_existing.user_id is not null then
      update lecture_participants set status = 'active', joined_at = now(), left_at = null
        where lecture_id = v_request.lecture_id and user_id = v_request.user_id;
    else
      insert into lecture_participants (lecture_id, user_id, status, color, "order")
        values (v_request.lecture_id, v_request.user_id, 'active', p_color, 0);
    end if;

    update lecture_apply_requests set status = 'approved', responded_at = now(), responded_by = auth.uid()
      where id = p_request_id;
  else
    update lecture_apply_requests set status = 'rejected', responded_at = now(), responded_by = auth.uid()
      where id = p_request_id;
  end if;

  insert into activity_log (target_type, target_id, action, actor_id, after)
    values ('lecture', v_request.lecture_id, case when p_approve then 'apply_approve' else 'apply_reject' end,
      auth.uid(), jsonb_build_object('request_user_id', v_request.user_id));
end;
$$;

grant execute on function respond_join_request(uuid, boolean, text) to authenticated;

-- 退出。最後の1人が退出したら講義をアーカイブする。
create or replace function leave_lecture(p_lecture_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not is_active_lecture_participant(p_lecture_id, auth.uid()) then
    raise exception 'not a participant';
  end if;

  update lecture_participants set status = 'left', left_at = now()
    where lecture_id = p_lecture_id and user_id = auth.uid();

  perform 1 from lectures where id = p_lecture_id for update;
  select count(*) into v_count from lecture_participants
    where lecture_id = p_lecture_id and status = 'active';
  if v_count = 0 then
    perform set_config('app.bypass_archive_guard', 'on', true);
    update lectures set archived_at = now() where id = p_lecture_id;
  end if;

  insert into activity_log (target_type, target_id, action, actor_id)
    values ('lecture', p_lecture_id, 'leave', auth.uid());
end;
$$;

grant execute on function leave_lecture(uuid) to authenticated;

-- 繰り返しの共有課題を一括作成（参加者なら誰でも）
create or replace function add_lecture_recurring_tasks(
  p_lecture_id uuid,
  p_title text,
  p_start_from date,
  p_interval_weeks integer,
  p_duration_days integer,
  p_count integer
)
returns setof lecture_tasks
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_recurrence_id uuid;
  i integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not is_active_lecture_participant(p_lecture_id, auth.uid()) then
    raise exception 'not a participant';
  end if;
  if p_count < 1 or p_count > 52 then
    raise exception 'invalid count';
  end if;

  insert into lecture_recurrences (lecture_id, title, start_from, interval_weeks, duration_days, count, created_by)
    values (p_lecture_id, p_title, p_start_from, p_interval_weeks, p_duration_days, p_count, auth.uid())
    returning id into v_recurrence_id;

  for i in 0..(p_count - 1) loop
    insert into lecture_tasks (lecture_id, recurrence_id, title, due_date, created_by)
      values (
        p_lecture_id,
        v_recurrence_id,
        p_title,
        p_start_from + (i * p_interval_weeks * 7 + p_duration_days),
        auth.uid()
      );
  end loop;

  return query select * from lecture_tasks where recurrence_id = v_recurrence_id order by due_date;
end;
$$;

grant execute on function add_lecture_recurring_tasks(uuid, text, date, integer, integer, integer) to authenticated;

-- ------------------------------------------------------------
-- パーティー
-- ------------------------------------------------------------

create or replace function create_party(p_name text)
returns parties
language plpgsql
security definer
set search_path = public
as $$
declare
  v_party parties;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text)::bigint);

  select count(*) into v_count from party_members where user_id = auth.uid() and status = 'active';
  if v_count >= limit_user_max_parties() then
    raise exception 'too many parties';
  end if;

  insert into parties (name) values (trim(p_name)) returning * into v_party;
  insert into party_members (party_id, user_id, status) values (v_party.id, auth.uid(), 'active');

  insert into activity_log (target_type, target_id, action, actor_id, after)
    values ('party', v_party.id, 'create', auth.uid(), to_jsonb(v_party));

  return v_party;
end;
$$;

grant execute on function create_party(text) to authenticated;

create or replace function invite_to_party(p_party_id uuid, p_invitee_id uuid)
returns party_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite party_invites;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_invitee_id = auth.uid() then raise exception 'cannot invite yourself'; end if;
  if not exists(select 1 from party_members where party_id = p_party_id and user_id = auth.uid() and status = 'active') then
    raise exception 'not a member of this party';
  end if;
  if is_blocked(auth.uid(), p_invitee_id) then
    raise exception 'blocked';
  end if;
  if exists(select 1 from party_members where party_id = p_party_id and user_id = p_invitee_id and status = 'active') then
    raise exception 'already a member';
  end if;

  perform 1 from parties where id = p_party_id for update;
  select count(*) into v_count from party_members where party_id = p_party_id and status = 'active';
  if v_count >= limit_party_max_members() then
    raise exception 'party is full';
  end if;

  insert into party_invites (party_id, inviter_id, invitee_id)
    values (p_party_id, auth.uid(), p_invitee_id)
    returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function invite_to_party(uuid, uuid) to authenticated;

create or replace function respond_party_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite party_invites;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_invite from party_invites where id = p_invite_id for update;
  if v_invite is null or v_invite.status <> 'pending' or v_invite.invitee_id <> auth.uid() then
    raise exception 'invite not found';
  end if;

  if p_accept then
    perform pg_advisory_xact_lock(hashtext(auth.uid()::text)::bigint);
    select count(*) into v_count from party_members where user_id = auth.uid() and status = 'active';
    if v_count >= limit_user_max_parties() then
      raise exception 'too many parties';
    end if;

    perform 1 from parties where id = v_invite.party_id for update;
    select count(*) into v_count from party_members where party_id = v_invite.party_id and status = 'active';
    if v_count >= limit_party_max_members() then
      raise exception 'party is full';
    end if;

    insert into party_members (party_id, user_id, status) values (v_invite.party_id, auth.uid(), 'active')
      on conflict (party_id, user_id) do update set status = 'active', joined_at = now(), left_at = null;

    update party_invites set status = 'accepted', responded_at = now() where id = p_invite_id;
  else
    update party_invites set status = 'declined', responded_at = now() where id = p_invite_id;
  end if;
end;
$$;

grant execute on function respond_party_invite(uuid, boolean) to authenticated;

create or replace function generate_invite_code()
returns text
language plpgsql
as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_result text := '';
  i integer;
begin
  for i in 1..8 loop
    v_result := v_result || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
  end loop;
  return v_result;
end;
$$;

create or replace function create_party_invite_code(p_party_id uuid, p_ttl interval default null, p_max_uses integer default null)
returns party_invite_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_ttl interval := coalesce(p_ttl, default_invite_code_ttl());
  v_max_uses integer := coalesce(p_max_uses, default_invite_code_max_uses());
  v_row party_invite_codes;
  v_attempt integer := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from party_members where party_id = p_party_id and user_id = auth.uid() and status = 'active') then
    raise exception 'not a member of this party';
  end if;
  if not (v_ttl = any(valid_invite_code_ttls())) then
    raise exception 'invalid ttl';
  end if;
  if not (v_max_uses = any(valid_invite_code_max_uses())) then
    raise exception 'invalid max_uses';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := generate_invite_code();
    begin
      insert into party_invite_codes (party_id, code, created_by, expires_at, max_uses)
        values (p_party_id, v_code, auth.uid(), now() + v_ttl, v_max_uses)
        returning * into v_row;
      exit;
    exception when unique_violation then
      if v_attempt > 5 then raise; end if;
    end;
  end loop;

  return v_row;
end;
$$;

grant execute on function create_party_invite_code(uuid, interval, integer) to authenticated;

create or replace function revoke_party_invite_code(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row party_invite_codes;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_row from party_invite_codes where id = p_code_id;
  if v_row is null then raise exception 'not found'; end if;
  if not exists(select 1 from party_members where party_id = v_row.party_id and user_id = auth.uid() and status = 'active') then
    raise exception 'not a member of this party';
  end if;
  update party_invite_codes set revoked_at = now() where id = p_code_id and revoked_at is null;
end;
$$;

grant execute on function revoke_party_invite_code(uuid) to authenticated;

create or replace function redeem_party_invite_code(p_code text)
returns parties
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row party_invite_codes;
  v_party parties;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_row from party_invite_codes where code = p_code for update;
  if v_row is null or v_row.revoked_at is not null or v_row.expires_at < now() or v_row.use_count >= v_row.max_uses then
    raise exception 'invalid or expired code';
  end if;

  if exists(select 1 from party_members where party_id = v_row.party_id and user_id = auth.uid() and status = 'active') then
    raise exception 'already a member';
  end if;

  perform pg_advisory_xact_lock(hashtext(auth.uid()::text)::bigint);
  select count(*) into v_count from party_members where user_id = auth.uid() and status = 'active';
  if v_count >= limit_user_max_parties() then
    raise exception 'too many parties';
  end if;

  perform 1 from parties where id = v_row.party_id for update;
  select count(*) into v_count from party_members where party_id = v_row.party_id and status = 'active';
  if v_count >= limit_party_max_members() then
    raise exception 'party is full';
  end if;

  insert into party_members (party_id, user_id, status) values (v_row.party_id, auth.uid(), 'active')
    on conflict (party_id, user_id) do update set status = 'active', joined_at = now(), left_at = null;

  update party_invite_codes set use_count = use_count + 1 where id = v_row.id;

  select * into v_party from parties where id = v_row.party_id;
  return v_party;
end;
$$;

grant execute on function redeem_party_invite_code(text) to authenticated;

create or replace function leave_party(p_party_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from party_members where party_id = p_party_id and user_id = auth.uid() and status = 'active') then
    raise exception 'not a member';
  end if;

  update party_members set status = 'left', left_at = now()
    where party_id = p_party_id and user_id = auth.uid();

  perform 1 from parties where id = p_party_id for update;
  select count(*) into v_count from party_members where party_id = p_party_id and status = 'active';
  if v_count = 0 then
    perform set_config('app.bypass_archive_guard', 'on', true);
    update parties set archived_at = now() where id = p_party_id;
  end if;

  insert into activity_log (target_type, target_id, action, actor_id)
    values ('party', p_party_id, 'leave', auth.uid());
end;
$$;

grant execute on function leave_party(uuid) to authenticated;

-- ------------------------------------------------------------
-- 除外投票（講義・パーティー共通）
-- ------------------------------------------------------------

create or replace function tally_exclusion_vote(p_vote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vote exclusion_votes;
  v_eligible integer;
  v_votes integer;
  v_needed integer;
begin
  select * into v_vote from exclusion_votes where id = p_vote_id for update;
  if v_vote is null or v_vote.status <> 'open' then return; end if;

  if v_vote.expires_at < now() then
    update exclusion_votes set status = 'expired', resolved_at = now() where id = p_vote_id;
    insert into activity_log (target_type, target_id, action, actor_id)
      values (v_vote.target_type, v_vote.target_id, 'exclusion_vote_expire', null);
    return;
  end if;

  if v_vote.target_type = 'lecture' then
    select count(*) into v_eligible from lecture_participants
      where lecture_id = v_vote.target_id and status = 'active' and user_id <> v_vote.target_user_id;
  else
    select count(*) into v_eligible from party_members
      where party_id = v_vote.target_id and status = 'active' and user_id <> v_vote.target_user_id;
  end if;

  select count(*) into v_votes from exclusion_vote_ballots where vote_id = p_vote_id;
  v_needed := ceil(v_eligible / 2.0);

  if v_votes >= v_needed and v_needed > 0 then
    update exclusion_votes set status = 'passed', resolved_at = now() where id = p_vote_id;
    if v_vote.target_type = 'lecture' then
      update lecture_participants set status = 'excluded'
        where lecture_id = v_vote.target_id and user_id = v_vote.target_user_id;
    else
      update party_members set status = 'excluded'
        where party_id = v_vote.target_id and user_id = v_vote.target_user_id;
    end if;
    insert into activity_log (target_type, target_id, action, actor_id, after)
      values (v_vote.target_type, v_vote.target_id, 'exclusion_vote_pass', null,
        jsonb_build_object('target_user_id', v_vote.target_user_id));
  end if;
end;
$$;

create or replace function start_exclusion_vote(p_target_type text, p_target_id uuid, p_target_user_id uuid)
returns exclusion_votes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vote exclusion_votes;
  v_is_member boolean;
  v_target_is_member boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_target_type not in ('lecture', 'party') then raise exception 'invalid target_type'; end if;
  if p_target_user_id = auth.uid() then raise exception 'cannot vote to exclude yourself'; end if;

  if p_target_type = 'lecture' then
    select exists(select 1 from lecture_participants where lecture_id = p_target_id and user_id = auth.uid() and status = 'active') into v_is_member;
    select exists(select 1 from lecture_participants where lecture_id = p_target_id and user_id = p_target_user_id and status = 'active') into v_target_is_member;
  else
    select exists(select 1 from party_members where party_id = p_target_id and user_id = auth.uid() and status = 'active') into v_is_member;
    select exists(select 1 from party_members where party_id = p_target_id and user_id = p_target_user_id and status = 'active') into v_target_is_member;
  end if;

  if not v_is_member then raise exception 'not a member'; end if;
  if not v_target_is_member then raise exception 'target is not an active member'; end if;

  insert into exclusion_votes (target_type, target_id, target_user_id, started_by)
    values (p_target_type, p_target_id, p_target_user_id, auth.uid())
    returning * into v_vote;

  insert into exclusion_vote_ballots (vote_id, voter_id) values (v_vote.id, auth.uid());

  insert into activity_log (target_type, target_id, action, actor_id, after)
    values (p_target_type, p_target_id, 'exclusion_vote_start', auth.uid(), jsonb_build_object('target_user_id', p_target_user_id));

  perform tally_exclusion_vote(v_vote.id);
  select * into v_vote from exclusion_votes where id = v_vote.id;
  return v_vote;
end;
$$;

grant execute on function start_exclusion_vote(text, uuid, uuid) to authenticated;

create or replace function cast_exclusion_ballot(p_vote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vote exclusion_votes;
  v_is_member boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_vote from exclusion_votes where id = p_vote_id;
  if v_vote is null or v_vote.status <> 'open' then raise exception 'vote not open'; end if;
  if v_vote.target_user_id = auth.uid() then raise exception 'cannot vote on your own exclusion'; end if;

  if v_vote.target_type = 'lecture' then
    select exists(select 1 from lecture_participants where lecture_id = v_vote.target_id and user_id = auth.uid() and status = 'active') into v_is_member;
  else
    select exists(select 1 from party_members where party_id = v_vote.target_id and user_id = auth.uid() and status = 'active') into v_is_member;
  end if;
  if not v_is_member then raise exception 'not a member'; end if;

  insert into exclusion_vote_ballots (vote_id, voter_id) values (p_vote_id, auth.uid())
    on conflict do nothing;

  perform tally_exclusion_vote(p_vote_id);
end;
$$;

grant execute on function cast_exclusion_ballot(uuid) to authenticated;

-- 期限切れの申請・投票をまとめて失効させる（pg_cron未使用のため、フロントエンドから
-- 画面表示時などの適当なタイミングで呼び出す想定）
create or replace function expire_stale_requests_and_votes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update lecture_apply_requests set status = 'expired'
    where status = 'pending' and expires_at < now();

  update exclusion_votes set status = 'expired', resolved_at = now()
    where status = 'open' and expires_at < now();
end;
$$;

grant execute on function expire_stale_requests_and_votes() to authenticated;
