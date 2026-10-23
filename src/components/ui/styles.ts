import type { CSSProperties } from 'react'

// UI キット（kit.tsx）と組み合わせて使う入力欄などのスタイル。
// 部品は kit.tsx、ルールは docs/ui-template.md を参照。

/**
 * テキスト入力・セレクトの共通スタイル（M3 の outlined text field: 高さ 56px・角 4px・文字 16px）。
 * 文字を 16px にしているのは、iPhone で入力欄を押したときに画面が勝手に拡大されないようにするため。
 * 選択中の枠の色は index.css の :focus-visible で付ける。
 */
export const inputStyle: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--shape-xs)',
  padding: '15px var(--space-4)', minHeight: 56, color: 'var(--text-primary)', outline: 'none',
  fontSize: 'var(--type-body-large-size)', lineHeight: 'var(--type-body-large-line)', letterSpacing: 'var(--type-body-large-tracking)',
  width: '100%', fontFamily: 'inherit', boxSizing: 'border-box',
}

/** 小さな補足テキスト（読み込み中など） */
export const emptyText: CSSProperties = {
  fontSize: 'var(--type-body-medium-size)', lineHeight: 'var(--type-body-medium-line)',
  color: 'var(--text-secondary)', margin: 0, padding: 'var(--space-2) 0',
}
