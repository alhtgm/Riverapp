-- ============================================================
-- テンプレート機能の廃止（spec-friends-party.md 10章）
--
-- テンプレートから取り込み済みの課題は、既存データ移行
-- (20261008180600) で各ユーザー自身の講義・課題としてコピー済み。
-- 旧 tasks テーブルの source_template_id / source_item_id は外部キー制約だけが
-- cascade で外れ、値は残る（旧テーブル自体の削除は別フェーズで行う）。
-- ============================================================

drop function if exists import_template_once(uuid);
drop function if exists increment_template_import_count(uuid);

drop table if exists template_imports cascade;
drop table if exists template_items cascade;
drop table if exists templates cascade;
