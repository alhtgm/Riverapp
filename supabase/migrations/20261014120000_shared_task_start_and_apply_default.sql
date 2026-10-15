-- ============================================================
-- 課題の発生日を共有する ＋ パーティー内公開の講義は申請オフを既定にする（2026-10 仕様変更）
--   1. lecture_tasks.start_date（発生日）を追加し、講義の参加者全員で共有する。
--      これまでは作業開始日が個人項目だけだったため、課題を追加した本人以外
--      （あとから参加した人を含む）には締切日1日だけのバーが表示されていた。
--      個人の task_user_state.work_start_date は、本人が変えたときだけ使う上書きになる。
--   2. 移行時に一律「申請オン」で作られた、公開範囲がパーティー内・公開しないの講義を
--      申請オフにする（設定画面で申請を切り替えたことがある講義はそのまま）。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 発生日（共有）
-- ------------------------------------------------------------
alter table lecture_tasks add column start_date date;

-- 既存課題の発生日を埋める。操作履歴・締切変更通知は出さない。
alter table lecture_tasks disable trigger lecture_tasks_activity;

-- 繰り返し課題: 締切 − 締切オフセット
update lecture_tasks lt
  set start_date = lt.due_date - r.duration_days
  from lecture_recurrences r
  where lt.recurrence_id = r.id and lt.start_date is null;

-- 単発課題: 追加した本人の作業開始日（なければ、参加者の中で最も早い作業開始日）
update lecture_tasks lt
  set start_date = coalesce(
    (select s.work_start_date from task_user_state s
      where s.task_id = lt.id and s.user_id = lt.created_by
        and s.work_start_date is not null and s.work_start_date <= lt.due_date),
    (select min(s.work_start_date) from task_user_state s
      where s.task_id = lt.id and s.work_start_date is not null and s.work_start_date <= lt.due_date)
  )
  where lt.start_date is null;

alter table lecture_tasks enable trigger lecture_tasks_activity;

-- 繰り返しの共有課題を一括作成（各回の発生日も保存する）
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
    insert into lecture_tasks (lecture_id, recurrence_id, title, start_date, due_date, created_by)
      values (
        p_lecture_id,
        v_recurrence_id,
        p_title,
        p_start_from + (i * p_interval_weeks * 7),
        p_start_from + (i * p_interval_weeks * 7 + p_duration_days),
        auth.uid()
      );
  end loop;

  return query select * from lecture_tasks where recurrence_id = v_recurrence_id order by due_date;
end;
$$;

grant execute on function add_lecture_recurring_tasks(uuid, text, date, integer, integer, integer) to authenticated;

-- ------------------------------------------------------------
-- 2. パーティー内・公開しないの講義は申請オフを既定にする
-- ------------------------------------------------------------
-- 既存講義の書き換えは操作履歴に残さない
alter table lectures disable trigger lectures_settings_activity;

update lectures l
  set apply_open = false
  where l.apply_open
    and l.visibility in ('party', 'private')
    and l.archived_at is null
    and not exists (
      select 1 from activity_log a
      where a.target_type = 'lecture' and a.target_id = l.id and a.action = 'settings_update'
        and (a.before ->> 'apply_open') is distinct from (a.after ->> 'apply_open')
    );

alter table lectures enable trigger lectures_settings_activity;
