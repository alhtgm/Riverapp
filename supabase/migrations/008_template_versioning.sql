-- ============================================================
-- テンプレートのバージョン管理と更新配信
-- 作者がテンプレートを編集するとバージョンが上がり、
-- 取り込んだ人に「更新あり」が出る（適用は本人の任意＝強制しない）。
-- 更新適用は項目単位で紐付けて、進捗・メモを保持したままマージする。
-- ============================================================

-- テンプレートのバージョン（編集のたびに +1）
alter table templates add column if not exists version integer not null default 1;

-- 取り込み側が「どのバージョンまで適用したか」
alter table template_imports add column if not exists applied_version integer not null default 1;

-- 取り込んだ課題が、テンプレートのどの項目由来かを紐付け（マージ時の突合に使う）
alter table tasks add column if not exists source_item_id uuid references template_items(id) on delete set null;

-- 取り込み側が自分の applied_version を更新できるように
drop policy if exists "Update own import" on template_imports;
create policy "Update own import" on template_imports for update to authenticated
  using (user_id = auth.uid());

-- 取り込み時に、その時点のバージョンを記録するよう関数を更新
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
  insert into template_imports (template_id, user_id, applied_version)
  values (p_template_id, auth.uid(), coalesce((select version from templates where id = p_template_id), 1))
  on conflict (template_id, user_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    update templates set import_count = import_count + 1 where id = p_template_id;
  end if;
end;
$$;

grant execute on function import_template_once(uuid) to authenticated;
