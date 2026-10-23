# River

大学生向けの課題管理アプリ。課題を横スクロールのタイムライン（ガントチャート風）で表示し、
フレンドやパーティーと講義・課題・進捗を共有できます。

- フロントエンド: React + Vite + TypeScript、状態管理は Zustand
- バックエンド: Supabase（Auth / PostgreSQL / RLS / RPC）
- ホスティング: Vercel

## 開発

```bash
npm install
npm run dev      # .env.local の VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を使う
npm run build
npm run lint
```

### ローカルの Supabase で動かす（本番DBに触れずに試す）

```bash
npx supabase start          # Docker が必要。supabase/migrations をすべて適用する
npx supabase db reset       # マイグレーションを当て直す
```

起動後に表示される API URL と anon key を `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` に設定して `npm run dev` する。

## ドキュメント

- `docs/spec-friends-party.md` — フレンド・パーティー機能の仕様（冒頭に実装時の変更点）
- `docs/ui-template.md` — UI テンプレート（分かりやすさ優先のルールと部品）

## ディレクトリ

```
src/
  components/
    auth/       ログイン・初回プロフィール作成
    timeline/   タイムライン本体・ヘッダーメニュー
    task/       課題の追加・詳細・クイックメニュー
    lecture/    講義の画面・講義カード・参加ボタン・公開範囲
    social/     つながり（通知・フレンド・パーティー・アカウント）・プロフィール
    ui/         UI キット（kit.tsx）・モーダル（Sheet）・トースト
  store/        useStore（講義・課題）、useSocialStore（フレンド・パーティー・通知）
  lib/          Supabase クライアント、上限値、エラーメッセージ変換など
supabase/migrations/  DB スキーマ・RLS・RPC
```
