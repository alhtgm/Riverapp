# River — AI エージェント向けルール

Claude Code・Codex などの AI エージェントは、作業を始める前に必ずこのファイルを読み、以下に従うこと。
人間の開発者も同じルールで作業する。

## ブランチ運用（Git-flow）

| ブランチ | 役割 | 直接 push | マージ |
|---|---|---|---|
| `main` | 本番（Vercel Production に自動デプロイ） | 禁止 | `develop` → `main` のリリースPRのみ。リポジトリ管理者（alhtgm）の承認が必要 |
| `develop` | 開発の共通ブランチ（Vercel Preview） | 禁止 | 作業ブランチからのPR。alhtgm の承認が必要 |
| `feature/*` `fix/*` など | 個人の作業ブランチ | 可 | — |

### 作業を始めるとき（必ず最初に行う）

1. 現在のブランチを確認する（`git branch --show-current`）。
2. `main` または `develop` にいる場合は、コードを変更する前に `develop` の最新から作業ブランチを切る。

   ```bash
   git fetch origin
   git switch -c feature/<内容を表す短い英語名> origin/develop
   ```

   - 新機能: `feature/<name>` / バグ修正: `fix/<name>` / 雑務・設定: `chore/<name>` / 文書: `docs/<name>`
   - ユーザーから明示されなくても、この手順は自動で行ってよい。
3. すでに作業ブランチにいて、その作業の続きであればそのまま使う。

### 作業を終えるとき

- 作業ブランチに commit して push し、**base を `develop`** にした PR を作る（`gh pr create --base develop`）。
- **`main` を base にした PR を作らない。** `main` への反映（リリース）は、ユーザーが明示的に指示したときだけ `develop` → `main` の PR で行う。
- `main` / `develop` への直接 push、強制 push（`--force`）、ブランチ削除はしない（GitHub のルールでも拒否される）。
- PR のマージは、ユーザーが指示したときだけ行う。

## 注意事項

- `.git/hooks/pre-push` が push のたびに `package.json` のパッチバージョンを上げる commit を作る。push 後に `git log origin/<branch>..<branch>` で未 push の bump commit が残っていないか確認し、残っていたら破棄してよい。
- Preview 環境（develop・作業ブランチ）も本番と同じ Supabase につながっている可能性がある。データの削除や `supabase/migrations` の本番適用は、ユーザーに確認してから行う。
- 動作確認は `npx supabase start` のローカル Supabase で行う（README 参照）。

## 開発コマンド

```bash
npm install
npm run dev
npm run build   # tsc -b && vite build
npm run lint
```

技術スタックとディレクトリ構成は `README.md` を参照。
