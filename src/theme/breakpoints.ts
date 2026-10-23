/**
 * 画面幅の区切り（M3 の window size class）。
 * CSS 変数は @media の条件に使えないので、数値はここで管理する（tokens.css の @media も同じ値）。
 *
 * | 区分        | 幅            | ナビゲーションの目安              |
 * |-------------|---------------|-----------------------------------|
 * | compact     | 600px 未満    | 下部のナビゲーションバー          |
 * | medium      | 600〜839px    | 左側のナビゲーションレール        |
 * | expanded    | 840〜1199px   | 左側のレール または サイドバー    |
 * | large       | 1200〜1599px  | サイドバー（本文は最大 840〜1040px）|
 * | extraLarge  | 1600px 以上   | サイドバー（本文は最大 840〜1040px）|
 */
export const BREAKPOINTS = {
  medium: 600,
  expanded: 840,
  large: 1200,
  extraLarge: 1600,
} as const

export type WindowSizeClass = 'compact' | 'medium' | 'expanded' | 'large' | 'extraLarge'

export function windowSizeClass(width: number): WindowSizeClass {
  if (width >= BREAKPOINTS.extraLarge) return 'extraLarge'
  if (width >= BREAKPOINTS.large) return 'large'
  if (width >= BREAKPOINTS.expanded) return 'expanded'
  if (width >= BREAKPOINTS.medium) return 'medium'
  return 'compact'
}
