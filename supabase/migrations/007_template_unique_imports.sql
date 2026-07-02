-- ============================================================
-- 取り込み回数を「延べ」→「ユニーク人数」に変更
-- ＋ 講義を特定しやすくする属性（教授名・時間割・学科名）
-- ============================================================

-- 誰がどのテンプレを取り込んだか（1人1回。ユニーク人数カウント用）
create table template_imports (
  template_id uuid references templates(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  created_at  timestamptz default now(),
  primary key (template_id, user_id)
);

alter table template_imports enable row level security;
-- 直接アクセスは自分の記録のみ（実際の加算は下の SECURITY DEFINER 関数が行う）
create policy "Insert own import" on template_imports for insert to authenticated
  with check (user_id = auth.uid());
create policy "Read own imports" on template_imports for select to authenticated
  using (user_id = auth.uid());

-- import_count 列（006 を飛ばしていても動くよう、ここでも保証する）
alter table templates add column if not exists import_count integer not null default 0;

-- 講義を特定しやすくする属性
alter table templates add column if not exists professor  text;  -- 教授名
alter table templates add column if not exists department text;  -- 学科名
alter table templates add column if not exists schedule   text;  -- 時間割（例: 月3限）

-- ユニーク人数でカウント：同じ人が複数回取り込んでも1回だけ加算
drop function if exists increment_template_import_count(uuid);

create or replace function import_template_once(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into template_imports (template_id, user_id)
  values (p_template_id, auth.uid())
  on conflict (template_id, user_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    update templates set import_count = import_count + 1 where id = p_template_id;
  end if;
end;
$$;

grant execute on function import_template_once(uuid) to authenticated;

-- セマンティクス変更（延べ→ユニーク）に伴い既存カウントをリセット
update templates set import_count = 0;
