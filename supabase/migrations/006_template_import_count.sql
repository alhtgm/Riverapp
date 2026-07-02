-- ============================================================
-- テンプレートの「取り込まれた回数」
-- 他ユーザーのタスクは RLS で見えないため、テンプレートにカウンタを持たせる。
-- 取り込む人は他人のテンプレートを UPDATE できないので、
-- SECURITY DEFINER 関数で安全に加算する。
-- ============================================================

alter table templates add column if not exists import_count integer not null default 0;

create or replace function increment_template_import_count(p_template_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update templates set import_count = import_count + 1 where id = p_template_id;
$$;

-- 認証済みユーザーが呼べるようにする
grant execute on function increment_template_import_count(uuid) to authenticated;
