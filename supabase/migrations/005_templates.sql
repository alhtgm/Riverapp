-- ============================================================
-- フェーズ2: テンプレート共有・取り込み
-- 講義単位で課題群を共有し、他の人が自分のタスクにコピー取り込みできる
-- 詳細は docs/account-requirements.md を参照
-- ============================================================

-- テンプレート本体（= 講義 = 1科目）
create table templates (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid references schools(id) on delete cascade not null,
  created_by   uuid references auth.users(id) on delete set null,
  creator_name text,                   -- 作成者の表示名（非正規化。profilesは本人しか読めないため）
  title        text not null,          -- 講義名（取り込み時の科目名になる）
  color        text not null,          -- 科目カラー
  description  text,
  created_at   timestamptz default now()
);

-- テンプレートに含まれる課題
create table template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id) on delete cascade not null,
  title       text not null,
  start_date  date not null,
  due_date    date not null,
  due_time    text,                   -- HH:MM（任意）
  sort_order  integer not null default 0,
  created_at  timestamptz default now()
);

-- 取り込み元テンプレートとの紐付け（フェーズ3の集計進捗で使う）
alter table tasks add column if not exists source_template_id uuid references templates(id) on delete set null;

-- ============================================================
-- RLS
-- ============================================================
alter table templates enable row level security;

-- 同じ学校のテンプレートは全員が閲覧可
create policy "Read school templates"
  on templates for select to authenticated
  using (school_id in (select school_id from profiles where id = auth.uid()));

-- 作成は本人＋自分の学校スコープのみ（学校の全員が作れる）
create policy "Insert own templates"
  on templates for insert to authenticated
  with check (
    created_by = auth.uid()
    and school_id in (select school_id from profiles where id = auth.uid())
  );

-- 編集・削除は作成者のみ
create policy "Update own templates"
  on templates for update to authenticated
  using (created_by = auth.uid());
create policy "Delete own templates"
  on templates for delete to authenticated
  using (created_by = auth.uid());

alter table template_items enable row level security;

-- 親テンプレートが同じ学校なら閲覧可
create policy "Read school template items"
  on template_items for select to authenticated
  using (
    template_id in (
      select id from templates
      where school_id in (select school_id from profiles where id = auth.uid())
    )
  );

-- 親テンプレートの作成者のみ追加・編集・削除可
create policy "Insert own template items"
  on template_items for insert to authenticated
  with check (template_id in (select id from templates where created_by = auth.uid()));
create policy "Update own template items"
  on template_items for update to authenticated
  using (template_id in (select id from templates where created_by = auth.uid()));
create policy "Delete own template items"
  on template_items for delete to authenticated
  using (template_id in (select id from templates where created_by = auth.uid()));
