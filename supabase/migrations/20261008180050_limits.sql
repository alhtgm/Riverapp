-- ============================================================
-- フレンド・パーティー機能: 上限値の定数定義（1か所にまとめる）
-- spec-friends-party.md 0章「上限値」に対応。
-- テーブルのデフォルト値や RPC はすべてここの関数を参照する。
-- ============================================================

create or replace function limit_party_max_members() returns integer
  language sql immutable as $$ select 20 $$;

create or replace function limit_user_max_parties() returns integer
  language sql immutable as $$ select 10 $$;

create or replace function limit_lecture_max_participants() returns integer
  language sql immutable as $$ select 200 $$;

create or replace function limit_apply_request_ttl() returns interval
  language sql immutable as $$ select interval '14 days' $$;

create or replace function limit_exclusion_vote_ttl() returns interval
  language sql immutable as $$ select interval '7 days' $$;

-- 招待コードの有効期限（選択肢）: 1時間／24時間／7日。既定値は24時間。
create or replace function valid_invite_code_ttls() returns interval[]
  language sql immutable as $$ select array[interval '1 hour', interval '24 hours', interval '7 days'] $$;

create or replace function default_invite_code_ttl() returns interval
  language sql immutable as $$ select interval '24 hours' $$;

-- 招待コードの使用回数上限（選択肢）: 1／5／20回。既定値は5回。
create or replace function valid_invite_code_max_uses() returns integer[]
  language sql immutable as $$ select array[1, 5, 20] $$;

create or replace function default_invite_code_max_uses() returns integer
  language sql immutable as $$ select 5 $$;

-- party_invite_codes.max_uses は上記の選択肢のみを許可する
alter table party_invite_codes
  add constraint party_invite_codes_max_uses_valid
  check (max_uses = any(valid_invite_code_max_uses()));
