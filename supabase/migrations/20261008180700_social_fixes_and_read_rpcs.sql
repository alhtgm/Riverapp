-- ============================================================
-- フレンド・パーティー機能: 修正 + 画面表示用の読み取りRPC
--
-- 修正内容:
--   1. party_members の RLS が自分自身を参照して無限再帰になる問題を、
--      SECURITY DEFINER のヘルパー関数 is_active_party_member で回避する。
--   2. 自分の party_members 行を直接 UPDATE できたため、除外済みの人が
--      status を 'active' に戻せた → UPDATE ポリシーを削除（退出はRPC経由）。
--   3. friend_requests を status='accepted' で直接 INSERT できた／UPDATE で
--      相手を差し替えられた → 申請・承認は RPC 経由に限定する。
--   4. 公開範囲「全体」の講義で apply_open だけを false に更新できた
--      → トリガーを全 UPDATE で発火させる。
--   5. アーカイブ済み講義が can_view_lecture で見えていた → 見えないようにする。
--   6. 進捗の名前は講義の参加者にだけ見せる（7章）→ task_user_state と
--      lecture_participants の閲覧を参加者に限定し、参加者以外には人数だけを RPC で返す。
--   7. パーティー招待はフレンドのみ（3章）。
--   8. 除外の解除投票（8章「除外は、再度の投票で解除できる」）。
--   9. 投票の失効を履歴に残す（8章）。
-- ============================================================

-- ------------------------------------------------------------
-- 1. ヘルパー関数（RLS の自己参照回避のため SECURITY DEFINER）
-- ------------------------------------------------------------
create or replace function is_active_party_member(p_party_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from party_members
    where party_id = p_party_id and user_id = p_user_id and status = 'active'
  );
$$;

grant execute on function is_active_party_member(uuid, uuid) to authenticated;

-- lecture_participants の SELECT ポリシーから呼ぶため SECURITY DEFINER に変更する
create or replace function is_active_lecture_participant(p_lecture_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from lecture_participants
    where lecture_id = p_lecture_id and user_id = p_user_id and status = 'active'
  );
$$;

grant execute on function is_active_lecture_participant(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- パーティー関連ポリシーの差し替え
-- ------------------------------------------------------------
drop policy if exists "Members read party" on parties;
drop policy if exists "Members rename party" on parties;
drop policy if exists "Party members read roster" on party_members;
drop policy if exists "Self update party membership" on party_members;
drop policy if exists "Party members read invite codes" on party_invite_codes;
drop policy if exists "Respond own party invite" on party_invites;

create policy "Members read party"
  on parties for select to authenticated
  using (is_active_party_member(id, auth.uid()));

create policy "Members rename party"
  on parties for update to authenticated
  using (is_active_party_member(id, auth.uid()))
  with check (is_active_party_member(id, auth.uid()));

create policy "Party members read roster"
  on party_members for select to authenticated
  using (user_id = auth.uid() or is_active_party_member(party_id, auth.uid()));

create policy "Party members read invite codes"
  on party_invite_codes for select to authenticated
  using (is_active_party_member(party_id, auth.uid()));

-- ------------------------------------------------------------
-- 3. フレンド申請は RPC 経由のみ
-- ------------------------------------------------------------
drop policy if exists "Insert own friend request" on friend_requests;
drop policy if exists "Update friend request as participant" on friend_requests;
-- 拒否・取り下げ・解除（行削除）は当事者による直接 DELETE を引き続き許可する。

create or replace function send_friend_request(p_addressee_id uuid)
returns text  -- 'sent' | 'accepted'（相手から申請が来ていた場合は即フレンド）| 'already'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing friend_requests;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_addressee_id = auth.uid() then raise exception 'cannot friend yourself'; end if;
  if not exists(select 1 from profiles where id = p_addressee_id) then
    raise exception 'user not found';
  end if;

  -- ブロック関係にある相手には届かない（ブロックの有無は相手に知らせない）
  if is_blocked(auth.uid(), p_addressee_id) then
    return 'sent';
  end if;

  select * into v_existing from friend_requests
    where least(requester_id, addressee_id) = least(auth.uid(), p_addressee_id)
      and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_addressee_id)
    for update;

  if v_existing.id is not null then
    if v_existing.status = 'accepted' then
      return 'already';
    end if;
    if v_existing.addressee_id = auth.uid() then
      -- 相手から申請が来ていた → 承認扱い
      update friend_requests set status = 'accepted' where id = v_existing.id;
      return 'accepted';
    end if;
    return 'already';
  end if;

  insert into friend_requests (requester_id, addressee_id) values (auth.uid(), p_addressee_id);
  return 'sent';
end;
$$;

grant execute on function send_friend_request(uuid) to authenticated;

create or replace function accept_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update friend_requests set status = 'accepted'
    where id = p_request_id and addressee_id = auth.uid() and status = 'pending';
  if not found then raise exception 'request not found'; end if;
end;
$$;

grant execute on function accept_friend_request(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. 公開範囲「全体」の間は apply_open を常にオン（全 UPDATE で判定）
-- ------------------------------------------------------------
drop trigger if exists lectures_enforce_apply_open on lectures;
create trigger lectures_enforce_apply_open
  before insert or update on lectures
  for each row execute function enforce_lecture_apply_open();

drop policy if exists "Active participant can update lecture settings" on lectures;
create policy "Active participant can update lecture settings"
  on lectures for update to authenticated
  using (is_active_lecture_participant(id, auth.uid()))
  with check (is_active_lecture_participant(id, auth.uid()));

-- ------------------------------------------------------------
-- 5. アーカイブ済み講義は誰からも見えない
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

  if exists(
    select 1 from lecture_participants
    where lecture_id = p_lecture_id and user_id = p_user_id and status = 'active'
  ) then
    return true;
  end if;

  if lecture_has_blocked_participant(p_lecture_id, p_user_id) then
    return false;
  end if;

  if v_visibility = 'public' then
    return true;
  end if;

  if v_visibility = 'friends' then
    return exists(
      select 1 from lecture_participants lp
      where lp.lecture_id = p_lecture_id and lp.status = 'active'
        and (are_friends(p_user_id, lp.user_id) or share_active_party(p_user_id, lp.user_id))
    );
  end if;

  -- 'party'
  return exists(
    select 1 from lecture_participants lp
    where lp.lecture_id = p_lecture_id and lp.status = 'active'
      and share_active_party(p_user_id, lp.user_id)
  );
end;
$$;

-- ------------------------------------------------------------
-- 6. 参加者以外には、誰が参加しているか・誰が進めているかを見せない
-- ------------------------------------------------------------
drop policy if exists "Read own or viewable lecture roster" on lecture_participants;
create policy "Read own or co-participant roster"
  on lecture_participants for select to authenticated
  using (user_id = auth.uid() or is_active_lecture_participant(lecture_id, auth.uid()));

drop policy if exists "View task state of viewable lecture" on task_user_state;
create policy "View own or co-participant task state"
  on task_user_state for select to authenticated
  using (
    user_id = auth.uid()
    or is_active_lecture_participant((select lecture_id from lecture_tasks where id = task_id), auth.uid())
  );

-- ------------------------------------------------------------
-- 7. パーティー招待はフレンドのみ
-- ------------------------------------------------------------
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
  if not is_active_party_member(p_party_id, auth.uid()) then
    raise exception 'not a member of this party';
  end if;
  -- ブロックするとフレンド関係は解除されるため、フレンド判定でブロックも弾ける
  if not are_friends(auth.uid(), p_invitee_id) then
    raise exception 'not friends';
  end if;
  if exists(select 1 from party_members where party_id = p_party_id and user_id = p_invitee_id and status = 'active') then
    raise exception 'already a member';
  end if;
  if exists(select 1 from party_members where party_id = p_party_id and user_id = p_invitee_id and status = 'excluded') then
    raise exception 'excluded from this party';
  end if;
  if exists(select 1 from party_invites where party_id = p_party_id and invitee_id = p_invitee_id and status = 'pending') then
    raise exception 'already invited';
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

-- 除外された人は招待コードでも戻れない
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

  select * into v_row from party_invite_codes where code = upper(trim(p_code)) for update;
  if v_row is null or v_row.revoked_at is not null or v_row.expires_at < now() or v_row.use_count >= v_row.max_uses then
    raise exception 'invalid or expired code';
  end if;

  if exists(select 1 from parties where id = v_row.party_id and archived_at is not null) then
    raise exception 'invalid or expired code';
  end if;
  if is_active_party_member(v_row.party_id, auth.uid()) then
    raise exception 'already a member';
  end if;
  if exists(select 1 from party_members where party_id = v_row.party_id and user_id = auth.uid() and status = 'excluded') then
    raise exception 'excluded from this party';
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

  insert into activity_log (target_type, target_id, action, actor_id)
    values ('party', v_row.party_id, 'join', auth.uid());

  select * into v_party from parties where id = v_row.party_id;
  return v_party;
end;
$$;

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
    if exists(select 1 from parties where id = v_invite.party_id and archived_at is not null) then
      raise exception 'party not found';
    end if;
    if exists(select 1 from party_members where party_id = v_invite.party_id and user_id = auth.uid() and status = 'excluded') then
      raise exception 'excluded from this party';
    end if;

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

    insert into activity_log (target_type, target_id, action, actor_id)
      values ('party', v_invite.party_id, 'join', auth.uid());
  else
    update party_invites set status = 'declined', responded_at = now() where id = p_invite_id;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 8. 除外の解除投票
-- ------------------------------------------------------------
alter table exclusion_votes
  add column if not exists kind text not null default 'exclude' check (kind in ('exclude', 'unexclude'));

drop policy if exists "View exclusion votes except as target" on exclusion_votes;
create policy "View exclusion votes except as target"
  on exclusion_votes for select to authenticated
  using (
    target_user_id <> auth.uid()
    and (
      (target_type = 'lecture' and is_active_lecture_participant(target_id, auth.uid()))
      or (target_type = 'party' and is_active_party_member(target_id, auth.uid()))
    )
  );

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
  v_new_status text;
begin
  select * into v_vote from exclusion_votes where id = p_vote_id for update;
  if v_vote is null or v_vote.status <> 'open' then return; end if;

  if v_vote.expires_at < now() then
    update exclusion_votes set status = 'expired', resolved_at = now() where id = p_vote_id;
    insert into activity_log (target_type, target_id, action, actor_id, after)
      values (v_vote.target_type, v_vote.target_id, 'exclusion_vote_expire', null,
        jsonb_build_object('target_user_id', v_vote.target_user_id, 'kind', v_vote.kind));
    return;
  end if;

  if v_vote.target_type = 'lecture' then
    select count(*) into v_eligible from lecture_participants
      where lecture_id = v_vote.target_id and status = 'active' and user_id <> v_vote.target_user_id;
  else
    select count(*) into v_eligible from party_members
      where party_id = v_vote.target_id and status = 'active' and user_id <> v_vote.target_user_id;
  end if;

  -- 現在もアクティブなメンバーの票だけを数える（退出した人の票は無効）
  if v_vote.target_type = 'lecture' then
    select count(*) into v_votes from exclusion_vote_ballots b
      join lecture_participants lp on lp.lecture_id = v_vote.target_id and lp.user_id = b.voter_id and lp.status = 'active'
      where b.vote_id = p_vote_id;
  else
    select count(*) into v_votes from exclusion_vote_ballots b
      join party_members pm on pm.party_id = v_vote.target_id and pm.user_id = b.voter_id and pm.status = 'active'
      where b.vote_id = p_vote_id;
  end if;

  v_needed := ceil(v_eligible / 2.0);

  if v_votes >= v_needed and v_needed > 0 then
    update exclusion_votes set status = 'passed', resolved_at = now() where id = p_vote_id;
    -- 解除が成立した人は「退出済み」に戻り、再び参加・申請できるようになる
    v_new_status := case when v_vote.kind = 'exclude' then 'excluded' else 'left' end;
    if v_vote.target_type = 'lecture' then
      update lecture_participants set status = v_new_status, left_at = coalesce(left_at, now())
        where lecture_id = v_vote.target_id and user_id = v_vote.target_user_id;
    else
      update party_members set status = v_new_status, left_at = coalesce(left_at, now())
        where party_id = v_vote.target_id and user_id = v_vote.target_user_id;
    end if;
    insert into activity_log (target_type, target_id, action, actor_id, after)
      values (v_vote.target_type, v_vote.target_id, 'exclusion_vote_pass', null,
        jsonb_build_object('target_user_id', v_vote.target_user_id, 'kind', v_vote.kind));
  end if;
end;
$$;

drop function if exists start_exclusion_vote(text, uuid, uuid);

create or replace function start_exclusion_vote(
  p_target_type text,
  p_target_id uuid,
  p_target_user_id uuid,
  p_kind text default 'exclude'
)
returns exclusion_votes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vote exclusion_votes;
  v_is_member boolean;
  v_target_status text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_target_type not in ('lecture', 'party') then raise exception 'invalid target_type'; end if;
  if p_kind not in ('exclude', 'unexclude') then raise exception 'invalid kind'; end if;
  if p_target_user_id = auth.uid() then raise exception 'cannot vote on yourself'; end if;

  if p_target_type = 'lecture' then
    v_is_member := is_active_lecture_participant(p_target_id, auth.uid());
    select status into v_target_status from lecture_participants
      where lecture_id = p_target_id and user_id = p_target_user_id;
  else
    v_is_member := is_active_party_member(p_target_id, auth.uid());
    select status into v_target_status from party_members
      where party_id = p_target_id and user_id = p_target_user_id;
  end if;

  if not v_is_member then raise exception 'not a member'; end if;
  if p_kind = 'exclude' and v_target_status is distinct from 'active' then
    raise exception 'target is not an active member';
  end if;
  if p_kind = 'unexclude' and v_target_status is distinct from 'excluded' then
    raise exception 'target is not excluded';
  end if;

  -- 期限切れの投票を先に片付けてから開始する（一意制約に引っかからないように）
  perform expire_stale_requests_and_votes();

  insert into exclusion_votes (target_type, target_id, target_user_id, started_by, kind)
    values (p_target_type, p_target_id, p_target_user_id, auth.uid(), p_kind)
    returning * into v_vote;

  insert into exclusion_vote_ballots (vote_id, voter_id) values (v_vote.id, auth.uid());

  insert into activity_log (target_type, target_id, action, actor_id, after)
    values (p_target_type, p_target_id, 'exclusion_vote_start', auth.uid(),
      jsonb_build_object('target_user_id', p_target_user_id, 'kind', p_kind));

  perform tally_exclusion_vote(v_vote.id);
  select * into v_vote from exclusion_votes where id = v_vote.id;
  return v_vote;
end;
$$;

grant execute on function start_exclusion_vote(text, uuid, uuid, text) to authenticated;

-- 進行中の投票一覧（対象者本人には見せない）
create or replace function get_open_votes(p_target_type text, p_target_id uuid)
returns table (
  id uuid,
  target_user_id uuid,
  kind text,
  ballots integer,
  needed integer,
  i_voted boolean,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_target_type = 'lecture' then
    if not is_active_lecture_participant(p_target_id, auth.uid()) then return; end if;
  elsif p_target_type = 'party' then
    if not is_active_party_member(p_target_id, auth.uid()) then return; end if;
  else
    return;
  end if;

  return query
  select v.id, v.target_user_id, v.kind,
    (select count(*)::int from exclusion_vote_ballots b where b.vote_id = v.id
       and (case when p_target_type = 'lecture'
              then is_active_lecture_participant(p_target_id, b.voter_id)
              else is_active_party_member(p_target_id, b.voter_id) end)),
    (case when p_target_type = 'lecture'
       then ceil((select count(*) from lecture_participants lp where lp.lecture_id = p_target_id and lp.status = 'active' and lp.user_id <> v.target_user_id) / 2.0)
       else ceil((select count(*) from party_members pm where pm.party_id = p_target_id and pm.status = 'active' and pm.user_id <> v.target_user_id) / 2.0)
     end)::int,
    exists(select 1 from exclusion_vote_ballots b where b.vote_id = v.id and b.voter_id = auth.uid()),
    v.expires_at
  from exclusion_votes v
  where v.target_type = p_target_type and v.target_id = p_target_id
    and v.status = 'open' and v.expires_at > now()
    and v.target_user_id <> auth.uid()
  order by v.created_at;
end;
$$;

grant execute on function get_open_votes(text, uuid) to authenticated;

-- ------------------------------------------------------------
-- 9. 期限切れの申請・投票の失効（投票の失効は履歴に残す）
-- ------------------------------------------------------------
create or replace function expire_stale_requests_and_votes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vote exclusion_votes;
begin
  update lecture_apply_requests set status = 'expired'
    where status = 'pending' and expires_at < now();

  for v_vote in
    update exclusion_votes set status = 'expired', resolved_at = now()
      where status = 'open' and expires_at < now()
      returning *
  loop
    insert into activity_log (target_type, target_id, action, actor_id, after)
      values (v_vote.target_type, v_vote.target_id, 'exclusion_vote_expire', null,
        jsonb_build_object('target_user_id', v_vote.target_user_id, 'kind', v_vote.kind));
  end loop;
end;
$$;

-- 参加申請は、期限切れの申請を片付けてから重複チェックする
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

  update lecture_apply_requests set status = 'expired'
    where lecture_id = p_lecture_id and user_id = auth.uid() and status = 'pending' and expires_at < now();

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

-- 承認時、申請中に除外された人や期限切れの申請は承認できない
create or replace function respond_join_request(p_request_id uuid, p_approve boolean, p_color text default '#0891B2')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request lecture_apply_requests;
  v_count integer;
  v_existing lecture_participants;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_request from lecture_apply_requests where id = p_request_id for update;
  if v_request is null or v_request.status <> 'pending' then
    raise exception 'request not pending';
  end if;
  if v_request.expires_at < now() then
    update lecture_apply_requests set status = 'expired' where id = p_request_id;
    raise exception 'request expired';
  end if;
  if not is_active_lecture_participant(v_request.lecture_id, auth.uid()) then
    raise exception 'not a participant of this lecture';
  end if;

  if p_approve then
    perform 1 from lectures where id = v_request.lecture_id for update;
    select count(*) into v_count from lecture_participants
      where lecture_id = v_request.lecture_id and status = 'active';
    if v_count >= limit_lecture_max_participants() then
      raise exception 'lecture is full';
    end if;

    select * into v_existing from lecture_participants
      where lecture_id = v_request.lecture_id and user_id = v_request.user_id;
    if v_existing.user_id is not null and v_existing.status = 'excluded' then
      raise exception 'excluded from this lecture';
    end if;
    if v_existing.user_id is not null then
      update lecture_participants set status = 'active', joined_at = now(), left_at = null
        where lecture_id = v_request.lecture_id and user_id = v_request.user_id;
    else
      insert into lecture_participants (lecture_id, user_id, status, color, "order")
        values (v_request.lecture_id, v_request.user_id, 'active', p_color,
          coalesce((select max("order") + 1 from lecture_participants where user_id = v_request.user_id), 0));
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

-- ------------------------------------------------------------
-- 自分の表示設定（講義の色・並び順）を変更する
-- lecture_participants には UPDATE ポリシーが無いため RPC で行う。
-- ------------------------------------------------------------
create or replace function update_my_lecture_prefs(p_lecture_id uuid, p_color text default null, p_order integer default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update lecture_participants
    set color = coalesce(p_color, color), "order" = coalesce(p_order, "order")
    where lecture_id = p_lecture_id and user_id = auth.uid() and status = 'active';
  if not found then raise exception 'not a participant'; end if;
end;
$$;

grant execute on function update_my_lecture_prefs(uuid, text, integer) to authenticated;

-- ------------------------------------------------------------
-- 画面表示用の読み取りRPC
-- ------------------------------------------------------------

-- 他ユーザーの基本情報（表示名・@handle）。自分をブロックしている相手は返さない。
create or replace function get_profiles(p_ids uuid[])
returns table (id uuid, handle text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.display_name
  from profiles p
  where p.id = any(p_ids)
    and (
      p.id = auth.uid()
      or not exists(select 1 from blocks b where b.blocker_id = p.id and b.blocked_id = auth.uid())
    );
$$;

grant execute on function get_profiles(uuid[]) to authenticated;

-- ユーザー検索は @handle の完全一致のみ（大文字小文字は区別しない）。
-- ブロック関係にある相手は結果に出さない。
create or replace function search_profile_by_handle(p_handle text)
returns table (id uuid, handle text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.display_name
  from profiles p
  where lower(p.handle) = lower(ltrim(trim(p_handle), '@'))
    and p.id <> auth.uid()
    and not is_blocked(auth.uid(), p.id);
$$;

grant execute on function search_profile_by_handle(text) to authenticated;

-- 講義の概要（参加人数・パーティー内の参加人数・自分の参加状態）。
-- 閲覧可能な講義だけを返す。
-- my_status: 'participant' | 'pending' | 'excluded' | 'none'
create or replace function lecture_summaries(p_ids uuid[], p_party_id uuid default null)
returns table (
  id uuid,
  title text,
  year integer,
  term text,
  professor text,
  visibility text,
  apply_open boolean,
  participant_count integer,
  party_member_count integer,
  my_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id, l.title, l.year, l.term, l.professor, l.visibility, l.apply_open,
    (select count(*)::int from lecture_participants lp
       where lp.lecture_id = l.id and lp.status = 'active'),
    case when p_party_id is not null and is_active_party_member(p_party_id, auth.uid()) then
      (select count(*)::int from lecture_participants lp
         join party_members pm on pm.user_id = lp.user_id and pm.party_id = p_party_id and pm.status = 'active'
         where lp.lecture_id = l.id and lp.status = 'active')
    end,
    coalesce(
      (select case lp.status when 'active' then 'participant' when 'excluded' then 'excluded' end
         from lecture_participants lp
         where lp.lecture_id = l.id and lp.user_id = auth.uid() and lp.status in ('active', 'excluded')),
      case when exists(
        select 1 from lecture_apply_requests r
        where r.lecture_id = l.id and r.user_id = auth.uid() and r.status = 'pending' and r.expires_at > now()
      ) then 'pending' else 'none' end
    )
  from lectures l
  where l.id = any(p_ids)
    and l.archived_at is null
    and can_view_lecture(l.id, auth.uid())
  order by l.year desc, l.title;
$$;

grant execute on function lecture_summaries(uuid[], uuid) to authenticated;

-- プロフィール画面: そのユーザーが参加している講義のうち、自分から見えるもの
create or replace function get_user_lectures(p_user_id uuid)
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
    array(select lp.lecture_id from lecture_participants lp
          where lp.user_id = p_user_id and lp.status = 'active')
  ) s
  where p_user_id = auth.uid() or not is_blocked(auth.uid(), p_user_id);
$$;

grant execute on function get_user_lectures(uuid) to authenticated;

-- パーティーのホーム画面: メンバーが参加している講義のうち、自分から見えるもの
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
    array(select distinct lp.lecture_id
          from lecture_participants lp
          join party_members pm on pm.user_id = lp.user_id and pm.party_id = p_party_id and pm.status = 'active'
          where lp.status = 'active'),
    p_party_id
  ) s
  where is_active_party_member(p_party_id, auth.uid());
$$;

grant execute on function get_party_lectures(uuid) to authenticated;

-- 進捗の相互確認（7章）: 取り組み中・完了の人ごとの行を返す。
-- 人数は講義を閲覧できる人なら誰でも数えられるが、user_id と名前は
-- その講義の参加者にだけ返す（ブロック関係にある相手は名前を伏せる）。
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
    and s.status in ('in_progress', 'done', 'submitted')
    and can_view_lecture(t.lecture_id, auth.uid());
$$;

grant execute on function get_lectures_progress(uuid[]) to authenticated;

-- 自分宛ての保留中のパーティー招待（招待された側はまだメンバーではないため
-- parties を直接読めない。パーティー名と人数をここで返す）
create or replace function get_my_party_invites()
returns table (id uuid, party_id uuid, party_name text, member_count integer, inviter_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.party_id, p.name,
    (select count(*)::int from party_members pm where pm.party_id = p.id and pm.status = 'active'),
    i.inviter_id, i.created_at
  from party_invites i
  join parties p on p.id = i.party_id and p.archived_at is null
  where i.invitee_id = auth.uid() and i.status = 'pending'
  order by i.created_at desc;
$$;

grant execute on function get_my_party_invites() to authenticated;

-- 参加申請の一覧（講義の参加者向け。申請者の名前付き）
create or replace function get_lecture_apply_requests(p_lecture_id uuid)
returns table (id uuid, user_id uuid, display_name text, handle text, created_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.user_id, p.display_name, p.handle, r.created_at, r.expires_at
  from lecture_apply_requests r
  left join profiles p on p.id = r.user_id
  where r.lecture_id = p_lecture_id
    and r.status = 'pending'
    and r.expires_at > now()
    and is_active_lecture_participant(p_lecture_id, auth.uid())
  order by r.created_at;
$$;

grant execute on function get_lecture_apply_requests(uuid) to authenticated;

-- ------------------------------------------------------------
-- 参加申請の通知に講義名を含める（却下された人は講義を閲覧できない場合があるため）
-- ------------------------------------------------------------
create or replace function notify_lecture_apply_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, payload)
  select lp.user_id, 'lecture_apply_request',
    jsonb_build_object('lecture_id', new.lecture_id, 'request_id', new.id, 'applicant_id', new.user_id,
      'title', (select title from lectures where id = new.lecture_id))
  from lecture_participants lp
  where lp.lecture_id = new.lecture_id and lp.status = 'active';
  return new;
end;
$$;

create or replace function notify_lecture_apply_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('approved', 'rejected') and old.status = 'pending' then
    insert into notifications (user_id, type, payload)
    values (new.user_id, 'lecture_apply_response',
      jsonb_build_object('lecture_id', new.lecture_id, 'request_id', new.id, 'approved', new.status = 'approved',
        'title', (select title from lectures where id = new.lecture_id)));
  end if;
  return new;
end;
$$;

-- パーティー招待の通知にパーティー名を含める
create or replace function notify_party_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, payload)
    values (new.invitee_id, 'party_invite',
      jsonb_build_object('party_id', new.party_id, 'invite_id', new.id, 'inviter_id', new.inviter_id,
        'party_name', (select name from parties where id = new.party_id)));
  return new;
end;
$$;
