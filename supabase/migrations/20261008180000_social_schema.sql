-- ============================================================
-- フレンド・パーティー機能 (1/6): @handle, ブロック, フレンド, パーティー
-- 詳細は spec-friends-party.md を参照
-- ============================================================

-- ------------------------------------------------------------
-- profiles.handle（ユーザーID / @handle）
-- ------------------------------------------------------------
alter table profiles add column if not exists handle text;

-- 大文字小文字を区別しない一意性。英数字・アンダースコアのみ、3〜20文字。
alter table profiles
  add constraint profiles_handle_format check (handle ~ '^[a-zA-Z0-9_]{3,20}$');

create unique index if not exists profiles_handle_lower_idx on profiles (lower(handle));


-- ------------------------------------------------------------
-- blocks（ブロック）
-- ------------------------------------------------------------
create table blocks (
  blocker_id uuid references auth.users(id) on delete cascade not null,
  blocked_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_id_idx on blocks (blocked_id);

alter table blocks enable row level security;

create policy "Read own blocks"
  on blocks for select to authenticated
  using (blocker_id = auth.uid());

create policy "Insert own block"
  on blocks for insert to authenticated
  with check (blocker_id = auth.uid());

create policy "Delete own block"
  on blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- ------------------------------------------------------------
-- friend_requests（フレンド申請・フレンド関係）
-- pending/accepted のみを保持する。拒否・取り下げ・解除は行削除。
-- ------------------------------------------------------------
create table friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id) on delete cascade not null,
  addressee_id uuid references auth.users(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  responded_at timestamptz,
  constraint friend_requests_no_self check (requester_id <> addressee_id)
);

-- 同じ2人の間で向きを問わず1件のみ（pending/accepted 問わず）
create unique index friend_requests_pair_idx
  on friend_requests (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index friend_requests_addressee_idx on friend_requests (addressee_id, status);
create index friend_requests_requester_idx on friend_requests (requester_id, status);

alter table friend_requests enable row level security;

create policy "Read own friend requests"
  on friend_requests for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "Insert own friend request"
  on friend_requests for insert to authenticated
  with check (requester_id = auth.uid());

create policy "Update friend request as participant"
  on friend_requests for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "Delete friend request as participant"
  on friend_requests for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ------------------------------------------------------------
-- parties（パーティー）
-- ------------------------------------------------------------
create table parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  archived_at timestamptz
);

create table party_members (
  party_id uuid references parties(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  status text not null default 'active' check (status in ('active', 'left', 'excluded')),
  joined_at timestamptz default now(),
  left_at timestamptz,
  primary key (party_id, user_id)
);

create index party_members_user_idx on party_members (user_id, status);
create index party_members_party_idx on party_members (party_id, status);

create table party_invites (
  id uuid primary key default gen_random_uuid(),
  party_id uuid references parties(id) on delete cascade not null,
  inviter_id uuid references auth.users(id) on delete cascade not null,
  invitee_id uuid references auth.users(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz default now(),
  responded_at timestamptz,
  constraint party_invites_no_self check (inviter_id <> invitee_id)
);

create unique index party_invites_pending_idx
  on party_invites (party_id, invitee_id) where status = 'pending';
create index party_invites_invitee_idx on party_invites (invitee_id, status);

create table party_invite_codes (
  id uuid primary key default gen_random_uuid(),
  party_id uuid references parties(id) on delete cascade not null,
  code text not null,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  max_uses integer not null,
  use_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

create unique index party_invite_codes_code_idx on party_invite_codes (code);
create index party_invite_codes_party_idx on party_invite_codes (party_id);

alter table parties enable row level security;
alter table party_members enable row level security;
alter table party_invites enable row level security;
alter table party_invite_codes enable row level security;

-- parties: アクティブなメンバーのみ閲覧・更新可（名称変更はメンバーなら誰でも）
create policy "Members read party"
  on parties for select to authenticated
  using (
    id in (select party_id from party_members where user_id = auth.uid() and status = 'active')
  );

create policy "Members rename party"
  on parties for update to authenticated
  using (
    id in (select party_id from party_members where user_id = auth.uid() and status = 'active')
  );

-- party_members: 同じパーティーのアクティブメンバーなら他メンバーの行も読める
create policy "Party members read roster"
  on party_members for select to authenticated
  using (
    party_id in (select party_id from party_members where user_id = auth.uid() and status = 'active')
  );

create policy "Self update party membership"
  on party_members for update to authenticated
  using (user_id = auth.uid());

-- party_invites: 本人（招待した側／された側）のみ閲覧・応答可
create policy "Read own party invites"
  on party_invites for select to authenticated
  using (inviter_id = auth.uid() or invitee_id = auth.uid());

create policy "Respond own party invite"
  on party_invites for update to authenticated
  using (invitee_id = auth.uid() or inviter_id = auth.uid());

-- party_invite_codes: アクティブメンバーのみ閲覧（コード無効化は本人確認含めRPC側で保証）
create policy "Party members read invite codes"
  on party_invite_codes for select to authenticated
  using (
    party_id in (select party_id from party_members where user_id = auth.uid() and status = 'active')
  );

-- insert/delete 相当の操作（発行・無効化・参加・退出）は、人数上限や競合チェックが
-- 必要なため直接の RLS insert/delete は許可せず、後続マイグレーションの
-- SECURITY DEFINER 関数（RPC）経由のみで行う。
