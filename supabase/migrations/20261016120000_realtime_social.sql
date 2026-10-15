-- ============================================================
-- フレンド・パーティー・参加申請をリアルタイムで画面に反映する（2026-10）
--   これまでは画面を開いたときと1分ごとにしか読み直さなかったため、
--   フレンド申請を受けた側や、フレンドになった直後にパーティーへ招待したい側が
--   再読み込みしないと最新の状態にならなかった。
--   Supabase Realtime で次の表の追加・変更を受け取れるようにする。
--   受け取れるのは各表の RLS で読める行だけ（本人宛ての通知、自分が関わる申請・招待、
--   自分が所属するパーティーのメンバー、自分が参加する講義への参加申請）。
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array['notifications', 'friend_requests', 'party_invites', 'party_members', 'lecture_apply_requests']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
