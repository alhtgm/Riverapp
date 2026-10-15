-- ============================================================
-- 移行した講義の学期を「2026年度 後期」にそろえる（2026-10、今回限りのデータ修正）
--   v1.1.0 で旧データ（subjects）から移行した講義は、年度 = 作成した年・学期 = 「その他」の
--   仮置きになっていた。学期の切り替え（v1.2.0）でこれらが「その他」のシートに入ってしまうため、
--   全ユーザー分を 2026年度 後期 に移す。
--   対象は「旧データから移行した講義」かつ「学期がまだ仮置きの『その他』のまま」のものだけ。
--   移行後に参加者が学期を変えた講義や、新しく作られた講義は変更しない。
-- ============================================================

-- 移行時に作った講義は、旧 subjects と作成者・名前・作成日時が一致する
create temporary table legacy_lecture_ids on commit drop as
  select l.id
  from lectures l
  where l.term = 'other'
    and exists (
      select 1 from subjects s
      where s.user_id = l.created_by
        and s.created_at = l.created_at
    );

-- 今回の書き換えは操作履歴に残さない
alter table lectures disable trigger lectures_settings_activity;

update lectures
  set year = 2026, term = 'fall'
  where id in (select id from legacy_lecture_ids);

alter table lectures enable trigger lectures_settings_activity;

-- 最後に選んでいた学期が「2026年度 その他」の人は、次に開いたとき 2026年度 後期 を開く
update auth.users
  set raw_user_meta_data = jsonb_set(raw_user_meta_data, '{last_semester}', '"2026-fall"')
  where raw_user_meta_data ->> 'last_semester' = '2026-other';
