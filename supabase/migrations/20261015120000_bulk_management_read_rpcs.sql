-- ============================================================
-- まとめて管理画面用の読み取り RPC（2026-10）
--   講義ごと・パーティーごとに画面を開かなくても、
--   届いている参加申請と、パーティーへの招待状況を一度に読めるようにする。
--   書き込みは既存の RPC（respond_join_request / invite_to_party など）をそのまま使う。
-- ============================================================

-- 自分が参加しているすべての講義に届いている参加申請
create or replace function get_my_pending_apply_requests()
returns table (
  id uuid, lecture_id uuid, lecture_title text, user_id uuid, display_name text, handle text,
  created_at timestamptz, expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.lecture_id, l.title, r.user_id, p.display_name, p.handle, r.created_at, r.expires_at
  from lecture_apply_requests r
  join lectures l on l.id = r.lecture_id and l.archived_at is null
  join lecture_participants me
    on me.lecture_id = r.lecture_id and me.user_id = auth.uid() and me.status = 'active'
  left join profiles p on p.id = r.user_id
  where r.status = 'pending'
    and r.expires_at > now()
  order by r.created_at;
$$;

grant execute on function get_my_pending_apply_requests() to authenticated;

-- 自分が所属しているパーティーで、返事待ちになっている招待（誰が招待したかは問わない）
create or replace function get_my_parties_pending_invites()
returns table (party_id uuid, invitee_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select i.party_id, i.invitee_id
  from party_invites i
  join party_members me
    on me.party_id = i.party_id and me.user_id = auth.uid() and me.status = 'active'
  where i.status = 'pending';
$$;

grant execute on function get_my_parties_pending_invites() to authenticated;
