-- ============================================================
-- フレンド・パーティー機能 (4/6): 権限判定関数 + RLSポリシー
--
-- 設計方針:
--   - 講義の閲覧可否は can_view_lecture(lecture_id, user_id) に集約する。
--   - ブロック関係は公開範囲より常に優先する（全体公開でも、ブロック関係にある
--     参加者が1人でもいれば見えない）。※ただし自分自身が参加者の場合は常に見える。
--   - 除外(exclusion)は「閲覧可否」には影響しない。除外は「参加・申請ボタンを
--     表示しない」ことにのみ影響する（5章）。そのため can_view_lecture には
--     除外判定を含めない。
--   - 人数上限・競合を伴う更新（参加・招待・投票集計など）は、ここでは
--     SELECT 用のポリシーのみ定義し、実際の更新は 20261008180400 の
--     SECURITY DEFINER 関数（RPC）経由のみに限定する。
-- ============================================================

-- ------------------------------------------------------------
-- ヘルパー関数
-- ブロック関係は「見られる側」の blocks 行を参照する必要があるため、
-- RLS の自己参照を回避する目的で SECURITY DEFINER にする。
-- ------------------------------------------------------------
create or replace function is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from friend_requests
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

create or replace function share_active_party(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from party_members pa
    join party_members pb on pa.party_id = pb.party_id
    where pa.user_id = a and pb.user_id = b
      and pa.status = 'active' and pb.status = 'active'
  );
$$;

-- 対象の講義のアクティブ参加者の中に、p_user_id とブロック関係にある人が
-- 1人でもいるか（本人除く）
create or replace function lecture_has_blocked_participant(p_lecture_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from lecture_participants lp
    where lp.lecture_id = p_lecture_id
      and lp.status = 'active'
      and lp.user_id <> p_user_id
      and is_blocked(p_user_id, lp.user_id)
  );
$$;

-- 講義の閲覧可否を判定する中核関数。すべての関連テーブルの SELECT ポリシーはこれを使う。
create or replace function can_view_lecture(p_lecture_id uuid, p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_is_participant boolean;
  v_visibility text;
begin
  if p_user_id is null then
    return false;
  end if;

  select exists(
    select 1 from lecture_participants
    where lecture_id = p_lecture_id and user_id = p_user_id and status = 'active'
  ) into v_is_participant;

  if v_is_participant then
    return true;
  end if;

  if lecture_has_blocked_participant(p_lecture_id, p_user_id) then
    return false;
  end if;

  select visibility into v_visibility from lectures where id = p_lecture_id;
  if v_visibility is null then
    return false;
  end if;

  if v_visibility = 'public' then
    return true;
  end if;

  if v_visibility = 'friends' then
    -- フレンドまで ⊃ パーティー内 なので、フレンドかパーティー仲間のどちらかでよい
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

grant execute on function is_blocked(uuid, uuid) to authenticated;
grant execute on function are_friends(uuid, uuid) to authenticated;
grant execute on function share_active_party(uuid, uuid) to authenticated;
grant execute on function lecture_has_blocked_participant(uuid, uuid) to authenticated;
grant execute on function can_view_lecture(uuid, uuid) to authenticated;

-- 本人が、ある講義のアクティブ参加者かどうか（自分の行は self-select ポリシーで
-- 見えるため、こちらは security definer ではない通常関数でよい）
create or replace function is_active_lecture_participant(p_lecture_id uuid, p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from lecture_participants
    where lecture_id = p_lecture_id and user_id = p_user_id and status = 'active'
  );
$$;

-- ------------------------------------------------------------
-- lectures
-- ------------------------------------------------------------
create policy "Can view lecture"
  on lectures for select to authenticated
  using (can_view_lecture(id, auth.uid()));

create policy "Any authenticated user can create lecture"
  on lectures for insert to authenticated
  with check (created_by = auth.uid());

-- 設定変更（講義名・年度・学期・担当教員・公開範囲・申請オンオフ）は参加者なら誰でも。
-- archived_at は RPC（leave_lecture）専用のガードトリガーで別途保護する（後続マイグレーション）。
create policy "Active participant can update lecture settings"
  on lectures for update to authenticated
  using (is_active_lecture_participant(id, auth.uid()));

-- ------------------------------------------------------------
-- lecture_participants
-- 変更（参加・退出・除外・色/並び順変更）はすべて RPC 経由のみ（挿入・更新ポリシーなし）。
-- ------------------------------------------------------------
create policy "Read own or viewable lecture roster"
  on lecture_participants for select to authenticated
  using (user_id = auth.uid() or can_view_lecture(lecture_id, auth.uid()));

-- ------------------------------------------------------------
-- lecture_apply_requests
-- 作成（申請）は RPC 経由（人数上限・apply_open チェックのため）。
-- 承認/却下も RPC 経由（参加者追加を伴うため）。
-- 取り下げ（cancel）のみ、申請者本人が直接 UPDATE してよい。
-- ------------------------------------------------------------
create policy "Read own requests or as participant"
  on lecture_apply_requests for select to authenticated
  using (user_id = auth.uid() or is_active_lecture_participant(lecture_id, auth.uid()));

create policy "Requester can cancel own pending request"
  on lecture_apply_requests for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'cancelled');

-- ------------------------------------------------------------
-- lecture_recurrences
-- ------------------------------------------------------------
create policy "View recurrences of viewable lecture"
  on lecture_recurrences for select to authenticated
  using (can_view_lecture(lecture_id, auth.uid()));

create policy "Active participant can create recurrence"
  on lecture_recurrences for insert to authenticated
  with check (is_active_lecture_participant(lecture_id, auth.uid()) and created_by = auth.uid());

-- ------------------------------------------------------------
-- lecture_tasks
-- 共有項目は参加者なら誰でも追加・編集（論理削除・復元含む）できる。
-- ------------------------------------------------------------
create policy "View tasks of viewable lecture"
  on lecture_tasks for select to authenticated
  using (can_view_lecture(lecture_id, auth.uid()));

create policy "Active participant can add task"
  on lecture_tasks for insert to authenticated
  with check (is_active_lecture_participant(lecture_id, auth.uid()) and created_by = auth.uid());

create policy "Active participant can edit task"
  on lecture_tasks for update to authenticated
  using (is_active_lecture_participant(lecture_id, auth.uid()));

-- ------------------------------------------------------------
-- task_user_state
-- 個人項目（進捗・作業予定期間・メモ）は本人のみ編集可。
-- ただし「進捗の相互確認」(7章)のため、閲覧はその講義を見られる人全員に許可する。
-- 初期行の作成は SECURITY DEFINER トリガー経由のみ（クライアントからの insert は不可）。
-- ------------------------------------------------------------
create policy "View task state of viewable lecture"
  on task_user_state for select to authenticated
  using (
    user_id = auth.uid()
    or can_view_lecture((select lecture_id from lecture_tasks where id = task_id), auth.uid())
  );

create policy "Self update own task state"
  on task_user_state for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- exclusion_votes / exclusion_vote_ballots
-- 開始・投票・集計はすべて RPC 経由。対象者自身には投票中であることを見せない。
-- ------------------------------------------------------------
create policy "View exclusion votes except as target"
  on exclusion_votes for select to authenticated
  using (
    target_user_id <> auth.uid()
    and (
      (target_type = 'lecture' and can_view_lecture(target_id, auth.uid()))
      or (target_type = 'party' and target_id in (
            select party_id from party_members where user_id = auth.uid() and status = 'active'
          ))
    )
  );

create policy "Read own ballot"
  on exclusion_vote_ballots for select to authenticated
  using (voter_id = auth.uid());

-- ------------------------------------------------------------
-- activity_log（読み取り専用。書き込みはトリガーのみ）
-- ------------------------------------------------------------
create policy "View activity log of viewable target"
  on activity_log for select to authenticated
  using (
    (target_type = 'lecture' and can_view_lecture(target_id, auth.uid()))
    or (target_type = 'lecture_task' and can_view_lecture(
          (select lecture_id from lecture_tasks where id = target_id), auth.uid()
        ))
    or (target_type = 'party' and target_id in (
          select party_id from party_members where user_id = auth.uid() and status = 'active'
        ))
  );
