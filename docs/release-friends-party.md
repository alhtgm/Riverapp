# 本番反映手順 — フレンド・パーティー機能（v1.1.0）

この PR は **DB の変更と画面の変更が一体** になっています。新しい画面は新しいテーブルを読み書きし、
古い画面は古いテーブル（subjects / tasks / recurrences / templates）を使うため、
**DB の適用と Vercel へのデプロイはできるだけ間を空けずに行う**必要があります。

> ⚠️ PR を作っただけで Vercel のプレビューが作られますが、プレビューは本番 DB を見ているため
> **マイグレーション適用前のプレビューは正しく動きません**（新しいテーブルがまだ無い）。
> 動作確認はローカルの Supabase（README 参照）で行ってください。

## 適用するマイグレーション

| ファイル | 内容 |
|---|---|
| 20261008180000_social_schema.sql | @handle、ブロック、フレンド、パーティー |
| 20261008180050_limits.sql | 上限値 |
| 20261008180100_lectures_schema.sql | 講義・共有課題・個人の進捗 |
| 20261008180200_exclusion_notifications_activity_log.sql | 除外投票・通知・操作履歴 |
| 20261008180300_permission_functions_and_rls.sql | 閲覧判定と RLS |
| 20261008180400_rpc_functions.sql | 参加・招待・投票などの RPC |
| 20261008180500_triggers.sql | 通知・履歴・初期データのトリガー |
| 20261008180550_handle_backfill.sql | 既存ユーザーに @handle を自動割り当て |
| 20261008180600_legacy_data_migration.sql | **既存データのコピー**（subjects/tasks → lectures/lecture_tasks） |
| 20261008180700_social_fixes_and_read_rpcs.sql | 権限の修正と画面用 RPC |
| 20261008180800_drop_templates.sql | **テンプレート関連テーブルの削除** |
| 20261008180900_party_scoped_visibility.sql | 公開範囲（選んだパーティー・公開しない） |
| 20261008181000_cleanup_unused.sql | 使わなくなった関数の削除 |

旧テーブル（subjects / tasks / recurrences）は**消しません**。移行がうまくいったことを確認してから、別の PR で削除します。

## 手順

### 0. 事前準備（前日まで）
1. Supabase CLI で本番プロジェクトに接続する
   ```bash
   npx supabase login
   npx supabase link --project-ref <本番のproject-ref>
   ```
2. 本番のマイグレーション履歴を確認する
   ```bash
   npx supabase migration list
   ```
   - `001_initial` 〜 `008_template_versioning` が「Remote」に**ある**場合 → そのまま 1. へ。
   - **無い**場合（SQL エディタで手動適用していた場合）→ 既に適用済みとして記録する：
     ```bash
     npx supabase migration repair --status applied 001 002 003 004 005 006 007 008
     ```
   - 一覧の結果は、作業前に必ず共有してください（ここを間違えると古いマイグレーションが再実行されます）。

### 1. バックアップ（無料プランは自動バックアップが無いため必須）
```bash
npx supabase db dump --data-only -f backup-before-v1.1.0.sql
npx supabase db dump -f schema-before-v1.1.0.sql
```

### 2. DB に適用 → すぐにマージ（数分で終える）
1. （任意）利用者に「数分間メンテナンス」と連絡する
2. マイグレーションを適用する
   ```bash
   npx supabase db push
   ```
3. エラーなく終わったら、**すぐに PR をマージ**する（Vercel が main を自動デプロイ。1〜2分）

### 3. 確認
- 自分のアカウントでログインし、今までの科目と課題が講義としてタイムラインに出ているか
- 課題のステータス・メモ・作業開始日が引き継がれているか
- メニュー →「アカウント設定」で @handle が割り当てられているか
  （日本語の表示名だった人は `user1a2b3c` のような ID になるので、各自変更してもらう）
- 新しく講義・課題を追加できるか

SQL エディタでの件数チェック：
```sql
select
  (select count(*) from subjects) as old_subjects,
  (select count(*) from lectures) as lectures,
  (select count(*) from tasks) as old_tasks,
  (select count(*) from lecture_tasks) as lecture_tasks,
  (select count(*) from profiles where handle is null) as no_handle;
-- old_subjects = lectures、old_tasks = lecture_tasks、no_handle = 0 になっていれば OK
```

### 4. うまくいかなかったとき
- 画面だけ戻す：Vercel の Deployments から前のデプロイを「Promote to Production」
  （ただし DB は新しい状態なので、テンプレート機能は動きません）
- DB も戻す：1. のバックアップから復元する（作業後に追加されたデータは失われます）

## 移行後の注意
- 既存の講義はすべて「パーティー内」・承認制で作られます。最初はどのパーティーにも見せていない
  （＝実質的に自分だけ）状態なので、共有したい講義は講義の画面の「設定」で公開範囲を選んでください。
- 既存の講義の年度は「作成した年」、学期は「その他」になっています。必要に応じて設定で直してください。
