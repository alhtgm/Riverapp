-- ============================================================
-- フレンド・パーティー機能 (6/6): トリガー
--   - 個人項目(task_user_state)の初期行自動作成
--   - 操作履歴(activity_log)の自動記録
--   - アプリ内通知(notifications)の自動生成
--   - archived_at の直接書き換えを防ぐガード
--   - フレンド申請の遷移制限、ブロック時のフレンド関係解除
-- ============================================================

-- ------------------------------------------------------------
-- task_user_state の初期行自動作成
-- ------------------------------------------------------------
create or replace function populate_task_user_state_for_new_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into task_user_state (task_id, user_id)
  select new.id, lp.user_id
  from lecture_participants lp
  where lp.lecture_id = new.lecture_id and lp.status = 'active'
  on conflict (task_id, user_id) do nothing;
  return new;
end;
$$;

create trigger lecture_tasks_populate_user_state
  after insert on lecture_tasks
  for each row execute function populate_task_user_state_for_new_task();

create or replace function populate_task_user_state_for_new_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    insert into task_user_state (task_id, user_id)
    select lt.id, new.user_id
    from lecture_tasks lt
    where lt.lecture_id = new.lecture_id and lt.deleted_at is null
    on conflict (task_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger lecture_participants_populate_user_state
  after insert or update on lecture_participants
  for each row execute function populate_task_user_state_for_new_participant();

-- ------------------------------------------------------------
-- lecture_tasks: 操作履歴 + 締切変更通知
-- ------------------------------------------------------------
create or replace function log_lecture_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'create';
    insert into activity_log (target_type, target_id, action, actor_id, after)
      values ('lecture_task', new.id, v_action, new.created_by, to_jsonb(new));
    return new;
  end if;

  -- UPDATE
  if old.deleted_at is null and new.deleted_at is not null then
    v_action := 'delete';
  elsif old.deleted_at is not null and new.deleted_at is null then
    v_action := 'restore';
  else
    v_action := 'update';
  end if;

  insert into activity_log (target_type, target_id, action, actor_id, before, after)
    values ('lecture_task', new.id, v_action, auth.uid(), to_jsonb(old), to_jsonb(new));

  if new.due_date is distinct from old.due_date then
    insert into notifications (user_id, type, payload)
    select lp.user_id, 'task_due_changed',
      jsonb_build_object('lecture_id', new.lecture_id, 'task_id', new.id, 'title', new.title,
        'old_due_date', old.due_date, 'new_due_date', new.due_date)
    from lecture_participants lp
    where lp.lecture_id = new.lecture_id and lp.status = 'active' and lp.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  return new;
end;
$$;

create trigger lecture_tasks_activity
  after insert or update on lecture_tasks
  for each row execute function log_lecture_task_activity();

-- ------------------------------------------------------------
-- lectures: 設定変更の履歴 + 公開範囲変更の通知 + archived_at ガード
-- ------------------------------------------------------------
create or replace function guard_archived_at()
returns trigger
language plpgsql
as $$
begin
  if new.archived_at is distinct from old.archived_at
     and coalesce(current_setting('app.bypass_archive_guard', true), 'off') <> 'on' then
    raise exception 'archived_at can only be changed via the leave RPC';
  end if;
  return new;
end;
$$;

create trigger lectures_guard_archived_at
  before update on lectures
  for each row execute function guard_archived_at();

create trigger parties_guard_archived_at
  before update on parties
  for each row execute function guard_archived_at();

create or replace function log_lecture_settings_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into activity_log (target_type, target_id, action, actor_id, before, after)
    values ('lecture', new.id, 'settings_update', auth.uid(), to_jsonb(old), to_jsonb(new));

  if new.visibility is distinct from old.visibility then
    insert into notifications (user_id, type, payload)
    select lp.user_id, 'lecture_visibility_changed',
      jsonb_build_object('lecture_id', new.id, 'title', new.title,
        'old_visibility', old.visibility, 'new_visibility', new.visibility)
    from lecture_participants lp
    where lp.lecture_id = new.id and lp.status = 'active' and lp.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  end if;

  return new;
end;
$$;

create trigger lectures_settings_activity
  after update on lectures
  for each row execute function log_lecture_settings_activity();

-- ------------------------------------------------------------
-- parties: 名称変更の履歴
-- ------------------------------------------------------------
create or replace function log_party_rename_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    insert into activity_log (target_type, target_id, action, actor_id, before, after)
      values ('party', new.id, 'rename', auth.uid(),
        jsonb_build_object('name', old.name), jsonb_build_object('name', new.name));
  end if;
  return new;
end;
$$;

create trigger parties_rename_activity
  after update on parties
  for each row execute function log_party_rename_activity();

-- ------------------------------------------------------------
-- 参加申請の通知
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
    jsonb_build_object('lecture_id', new.lecture_id, 'request_id', new.id, 'applicant_id', new.user_id)
  from lecture_participants lp
  where lp.lecture_id = new.lecture_id and lp.status = 'active';
  return new;
end;
$$;

create trigger lecture_apply_requests_notify
  after insert on lecture_apply_requests
  for each row execute function notify_lecture_apply_request();

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
      jsonb_build_object('lecture_id', new.lecture_id, 'request_id', new.id, 'approved', new.status = 'approved'));
  end if;
  return new;
end;
$$;

create trigger lecture_apply_requests_notify_response
  after update on lecture_apply_requests
  for each row execute function notify_lecture_apply_response();

-- ------------------------------------------------------------
-- フレンド申請: 遷移制限 + 通知
-- ------------------------------------------------------------
create or replace function enforce_friend_request_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if not (old.status = 'pending' and new.status = 'accepted' and auth.uid() = old.addressee_id) then
      raise exception 'invalid friend request transition';
    end if;
    new.responded_at := now();
  end if;
  return new;
end;
$$;

create trigger friend_requests_enforce_transitions
  before update on friend_requests
  for each row execute function enforce_friend_request_transitions();

-- ブロック関係にある相手へのフレンド申請は作成できない
create or replace function enforce_friend_request_not_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_blocked(new.requester_id, new.addressee_id) then
    raise exception 'blocked';
  end if;
  return new;
end;
$$;

create trigger friend_requests_enforce_not_blocked
  before insert on friend_requests
  for each row execute function enforce_friend_request_not_blocked();

create or replace function notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, payload)
    values (new.addressee_id, 'friend_request', jsonb_build_object('requester_id', new.requester_id));
  return new;
end;
$$;

create trigger friend_requests_notify
  after insert on friend_requests
  for each row execute function notify_friend_request();

create or replace function notify_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    insert into notifications (user_id, type, payload)
      values (new.requester_id, 'friend_accepted', jsonb_build_object('addressee_id', new.addressee_id));
  end if;
  return new;
end;
$$;

create trigger friend_requests_notify_accepted
  after update on friend_requests
  for each row execute function notify_friend_accepted();

-- ブロックするとフレンド関係・保留中のパーティー招待を解除する
create or replace function after_block_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from friend_requests
    where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
       or (requester_id = new.blocked_id and addressee_id = new.blocker_id);

  delete from party_invites
    where status = 'pending'
      and ((inviter_id = new.blocker_id and invitee_id = new.blocked_id)
        or (inviter_id = new.blocked_id and invitee_id = new.blocker_id));

  return new;
end;
$$;

create trigger blocks_cleanup
  after insert on blocks
  for each row execute function after_block_cleanup();

-- ------------------------------------------------------------
-- パーティー招待の通知
-- ------------------------------------------------------------
create or replace function notify_party_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, payload)
    values (new.invitee_id, 'party_invite', jsonb_build_object('party_id', new.party_id, 'invite_id', new.id, 'inviter_id', new.inviter_id));
  return new;
end;
$$;

create trigger party_invites_notify
  after insert on party_invites
  for each row execute function notify_party_invite();
