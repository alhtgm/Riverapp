# River — 大学生のための課題タイムライン

大学の課題を、横スクロールのタイムライン（ガントチャート風）で一覧できる課題管理アプリです。
締め切りまでの期間が帯で見えるので、「どの課題から手をつけるか」が一目で分かります。
フレンドやパーティー（仲間のグループ）と講義を共有し、誰が課題を終えたかを見ながら一緒に進められます。

**▶ アプリを開く：https://riverapp-nine.vercel.app/**
（スマホではホーム画面に追加すると、アプリのように使えます）

<!-- スクリーンショットを1〜2枚入れると伝わりやすくなります -->
<!-- ![タイムライン画面](docs/screenshot.png) -->

## 主な機能

- **課題タイムライン**：講義ごとに課題を帯で表示し、締め切りまでの期間をひと目で把握。表示の絞り込みにも対応
- **講義の共有**：パーティーのメンバーと講義に「参加」すると、課題が全員に共有される。公開範囲は講義ごとに選べる
- **進み具合の見える化**：未着手／進行中／完了／提出済みを、参加者どうしで確認できる
- **フレンド・パーティー**：招待コードでパーティーに参加。通知・受信箱でお知らせを受け取れる
- **フィードバックと管理画面**：利用者は設定から開発者に要望やバグを送れる。管理者は `/admin` で返信・お知らせ・利用状況の確認ができる
- **PWA**：アプリストアを通さず、ホーム画面に追加して使える

## 開発体制と現状

- 7人のチームで開発（[@alhtgm](https://github.com/alhtgm)：PM・メイン開発者）
- 仕様書を先に書き、チームで合意してから実装する進め方（例：[docs/spec-friends-party.md](docs/spec-friends-party.md)）
- ベータ版を公開中。ベータテスター20人が継続して利用し、フィードバックをもとに改善を続けている

## 使用技術

| 領域 | 技術 |
|---|---|
| フロントエンド | React, TypeScript, Vite, Zustand, Tailwind CSS |
| バックエンド | Supabase（認証 / PostgreSQL / RLS / RPC） |
| ホスティング | Vercel |

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
