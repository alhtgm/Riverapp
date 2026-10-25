-- ============================================================
-- 課題が追加されたときも、講義の参加者（追加した本人以外）に通知する
-- - 1件だけの課題: 課題ごとに 'task_added'
-- - 繰り返しの課題: 1件ずつ通知すると受信箱が埋まるので、繰り返しを作ったときに1件だけ 'task_added'（count つき）
-- - 締切の変更（'task_due_changed'）にも、誰が変えたか（actor_id）を入れる
-- ============================================================

create or replace function log_lecture_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_actor uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
begin
  if tg_op = 'INSERT' then
    v_action := 'create';
    insert into activity_log (target_type, target_id, action, actor_id, after)
      values ('lecture_task', new.id, v_action, new.created_by, to_jsonb(new));

    -- 繰り返しで作られた課題は、lecture_recurrences のトリガーでまとめて1件だけ通知する
    if new.recurrence_id is null then
      insert into notifications (user_id, type, payload)
      select lp.user_id, 'task_added',
        jsonb_build_object('lecture_id', new.lecture_id, 'task_id', new.id, 'title', new.title,
          'due_date', new.due_date, 'due_time', new.due_time, 'actor_id', new.created_by)
      from lecture_participants lp
      where lp.lecture_id = new.lecture_id and lp.status = 'active'
        and lp.user_id <> coalesce(new.created_by, v_actor);
    end if;
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
        'old_due_date', old.due_date, 'new_due_date', new.due_date, 'actor_id', auth.uid())
    from lecture_participants lp
    where lp.lecture_id = new.lecture_id and lp.status = 'active' and lp.user_id <> v_actor;
  end if;

  return new;
end;
$$;

-- 繰り返しの課題を作ったときに1件だけ通知する（最初と最後の締切・回数・間隔つき）
create or replace function notify_lecture_recurrence_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, payload)
  select lp.user_id, 'task_added',
    jsonb_build_object('lecture_id', new.lecture_id, 'recurrence_id', new.id, 'title', new.title,
      'count', new.count, 'interval_weeks', new.interval_weeks,
      'due_date', new.start_from + new.duration_days,
      'last_due_date', new.start_from + ((new.count - 1) * new.interval_weeks * 7 + new.duration_days),
      'actor_id', new.created_by)
  from lecture_participants lp
  where lp.lecture_id = new.lecture_id and lp.status = 'active'
    and lp.user_id <> coalesce(new.created_by, auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  return new;
end;
$$;

drop trigger if exists lecture_recurrences_notify_added on lecture_recurrences;
create trigger lecture_recurrences_notify_added
  after insert on lecture_recurrences
  for each row execute function notify_lecture_recurrence_added();
