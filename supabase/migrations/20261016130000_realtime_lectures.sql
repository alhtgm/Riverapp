-- ============================================================
-- 講義・課題・進捗もリアルタイムで画面に反映する（2026-10）
--   ほかの参加者が課題を追加・編集・削除したり締切を変えたりしたとき、
--   講義の設定や参加者が変わったとき、ほかの人の進捗が変わったときに、
--   再読み込みしなくても画面が更新されるようにする。
--   受け取れるのは各表の RLS で読める行だけ。画面側は自分が参加している講義に絞って購読する。
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array['lectures', 'lecture_tasks', 'lecture_participants', 'task_user_state', 'lecture_visible_parties']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
