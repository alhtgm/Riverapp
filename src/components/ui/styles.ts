import type { CSSProperties } from 'react'

// UI キット（kit.tsx）と組み合わせて使う入力欄などのスタイル。
// 部品は kit.tsx、ルールは docs/ui-template.md を参照。

/** テキスト入力・セレクトの共通スタイル（高さ38pxでタップしやすく） */
export const inputStyle: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
  padding: '8px 12px', minHeight: 38, fontSize: 14, color: 'var(--text-primary)', outline: 'none',
  width: '100%', fontFamily: 'inherit', letterSpacing: '-0.01em', boxSizing: 'border-box',
}

/** 小さな補足テキスト（読み込み中など） */
export const emptyText: CSSProperties = {
  fontSize: 13, color: 'var(--text-tertiary)', margin: 0, padding: '6px 2px',
}
