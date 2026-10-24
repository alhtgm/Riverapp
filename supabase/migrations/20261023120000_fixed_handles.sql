-- ============================================================
-- ユーザーID（@handle）をアプリ側で決めて固定する
-- - プロフィールを作るとき、ユーザーIDは自動で決める（本人の入力は使わない）
-- - 作ったあとは本人も変更できない（表示名はこれまでどおり変更できる）
-- - すでにあるユーザーIDはそのまま残す（変更できなくなるだけ）
-- ============================================================

-- 読み間違えやすい文字（i, l, o, 0, 1）を除いた英小文字と数字で 8 文字のIDを作る。
-- 重複していたら作り直す。RLS で他人の行が見えないと重複を見落とすので security definer にする
create or replace function generate_handle()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_chars constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_handle text;
begin
  loop
    v_handle := '';
    for i in 1..8 loop
      v_handle := v_handle || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from profiles where lower(handle) = v_handle);
  end loop;
  return v_handle;
end;
$$;

create or replace function profiles_assign_fixed_handle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.handle := generate_handle();
  elsif new.handle is distinct from old.handle and auth.role() = 'authenticated' then
    raise exception 'handle is fixed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_fixed_handle on profiles;
create trigger profiles_fixed_handle
  before insert or update of handle on profiles
  for each row execute function profiles_assign_fixed_handle();

-- まだユーザーIDがない人がいれば割り当て、以後は必ずある状態にする
update profiles set handle = generate_handle() where handle is null;
alter table profiles alter column handle set not null;
