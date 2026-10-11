-- ============================================================
-- 既存データ移行: subjects / tasks / recurrences → lectures / lecture_participants /
-- lecture_tasks / task_user_state / lecture_recurrences
--
-- ★★★ 適用タイミングに注意 ★★★
-- このマイグレーションは「コピー」であり「移設」ではない。適用後もフロントエンドが
-- 旧テーブル(subjects/tasks/recurrences)に書き込みを続ける限り、新テーブルのデータは
-- 時間とともに古いデータとズレていく。
--   → 本番環境への適用は、新しいタイムラインUIが新テーブルを読み書きするように
--     切り替わるフェーズ（新UIのリリースと同じタイミング）まで待つこと。
--     P1の他のマイグレーション（スキーマ・RLS・RPC）とは適用時期を分けてよい。
-- 旧テーブル(subjects/tasks/recurrences)自体の変更・削除はP8まで行わない
-- （本マイグレーションも旧テーブルへは一切書き込まない。読み取りのみ）。
--
-- 年度・学期の初期値: year = 各科目の created_at の年、term = 'other'（仮置き）。
-- 参加者は後からUIで修正できる想定。
-- ============================================================

do $$
declare
  v_subject record;
  v_lecture_id uuid;
  v_recurrence record;
  v_new_recurrence_id uuid;
  v_task record;
  v_new_task_id uuid;
begin
  create temporary table migration_subject_lecture_map (
    subject_id uuid primary key,
    lecture_id uuid not null
  ) on commit drop;

  create temporary table migration_recurrence_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temporary table migration_task_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  -- 1) subjects -> lectures + lecture_participants
  for v_subject in select * from subjects loop
    insert into lectures (title, year, term, professor, visibility, apply_open, created_by, created_at)
      values (
        v_subject.name,
        extract(year from v_subject.created_at)::int,
        'other',
        null,
        'party',
        true,
        v_subject.user_id,
        v_subject.created_at
      )
      returning id into v_lecture_id;

    insert into migration_subject_lecture_map (subject_id, lecture_id) values (v_subject.id, v_lecture_id);

    insert into lecture_participants (lecture_id, user_id, status, color, "order", joined_at)
      values (v_lecture_id, v_subject.user_id, 'active', v_subject.color, v_subject."order", v_subject.created_at);
  end loop;

  -- 2) recurrences -> lecture_recurrences
  for v_recurrence in select * from recurrences loop
    insert into lecture_recurrences (lecture_id, title, start_from, interval_weeks, duration_days, count, created_by, created_at)
      select m.lecture_id, v_recurrence.title, v_recurrence.start_from, v_recurrence.interval_weeks,
             v_recurrence.duration_days, v_recurrence.count, v_recurrence.user_id, v_recurrence.created_at
      from migration_subject_lecture_map m
      where m.subject_id = v_recurrence.subject_id
      returning id into v_new_recurrence_id;

    insert into migration_recurrence_map (old_id, new_id) values (v_recurrence.id, v_new_recurrence_id);
  end loop;

  -- 3) tasks -> lecture_tasks + task_user_state
  for v_task in select * from tasks loop
    insert into lecture_tasks (lecture_id, recurrence_id, title, due_date, due_time, created_by, created_at)
      select m.lecture_id,
             (select new_id from migration_recurrence_map where old_id = v_task.recurrence_id),
             v_task.title, v_task.due_date, v_task.due_time, v_task.user_id, v_task.created_at
      from migration_subject_lecture_map m
      where m.subject_id = v_task.subject_id
      returning id into v_new_task_id;

    insert into migration_task_map (old_id, new_id) values (v_task.id, v_new_task_id);

    -- lecture_tasks の INSERT トリガーが所有者分の task_user_state を既定値で
    -- 自動作成しているため、ここでは実際の値へ upsert する。
    insert into task_user_state (task_id, user_id, status, work_start_date, work_end_date, memo, updated_at)
      values (v_new_task_id, v_task.user_id, v_task.status, v_task.start_date, v_task.due_date, v_task.memo, v_task.created_at)
      on conflict (task_id, user_id) do update set
        status = excluded.status,
        work_start_date = excluded.work_start_date,
        work_end_date = excluded.work_end_date,
        memo = excluded.memo,
        updated_at = excluded.updated_at;
  end loop;
end;
$$;
