-- ============================================================
-- アカウントリニューアル: 学校所属 + コミュニティ表示名
-- 詳細は docs/account-requirements.md を参照
-- ============================================================

-- 学校マスタ
create table schools (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

-- 許可ドメイン（@より後ろ）。1校が複数ドメインを持てるよう別テーブル
create table school_domains (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid references schools(id) on delete cascade not null,
  domain     text not null unique,
  created_at timestamptz default now()
);

-- アプリ独自のユーザー情報（auth.users とは別レイヤー）
create table profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  school_email          text,
  -- 今は未使用。将来 OTP を入れる際に「確認済みの人だけ集計に入れる」へ切り替えるために確保
  school_email_verified boolean not null default false,
  school_id             uuid references schools(id),
  display_name          text not null,
  created_at            timestamptz default now()
);

-- RLS: 自分の profiles 行のみ読み書き可
alter table profiles enable row level security;
create policy "Users manage own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- schools / school_domains はオンボーディングのドメイン照合で全ユーザーが読む必要がある（機密ではない）
alter table schools enable row level security;
create policy "Authenticated can read schools"
  on schools for select to authenticated using (true);

alter table school_domains enable row level security;
create policy "Authenticated can read school_domains"
  on school_domains for select to authenticated using (true);

-- ============================================================
-- シードデータ
-- ============================================================

-- ★テスト用★ gmail.com を仮の学校ドメインとして登録。
--   普段の Gmail アドレスでオンボーディングを通しでテストできる。
--   本番公開前にこの行は削除すること。
insert into schools (name) values ('テスト大学');
insert into school_domains (school_id, domain)
  select id, 'gmail.com' from schools where name = 'テスト大学';

-- ↓ 自分の大学を登録する例（domain は @ より後ろだけ）。実際の値に書き換えて使う。
-- insert into schools (name) values ('○○大学');
-- insert into school_domains (school_id, domain)
--   select id, 's.yourschool.ac.jp' from schools where name = '○○大学';
