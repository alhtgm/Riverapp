/**
 * ユーザーが選んだ 1 色から、サイト全体の配色（index.css の CSS 変数）を作る。
 *
 * 色の計算は OKLCH（人の目の感じ方にそろえた「明るさ・鮮やかさ・色相」）で行う。
 * HSL と違い、明るさをそろえればどの色相でも同じ明るさに見えるので、黄色系が泥色になりにくい。
 *
 * 方針
 * - 選んだ色はそのままヘッダーに使う。読みやすさは色を暗くせず、上に載せる文字色（白か黒）で確保する
 * - 画面の地は「選んだ色 ＋ 無彩色 ＋ アクセント 1 色」に絞る
 * - 配色パターン（参考: amix-design の配色パターンツール）
 *   - 補色          : 選んだ色と反対側（180°）
 *   - トライアド    : 色相環を 3 等分（120°・240°）
 *   - テトラード    : 色相環を 4 等分（90°・180°・270°）
 *   - モノクロマティック: 同じ色相の明るさ違い
 *   - ティント      : 同じ色相に白を混ぜた淡い色
 * - ステータスの色はパターンの色そのものから作る（patternHues → assignStatusHues）。
 *   色が足りないパターンでは同じ色を共有し、進むほど濃くする。期限切れだけは警告の赤を保つ
 * - 文字に使う色は WCAG AA（4.5:1）を満たすまで明るさだけを動かす（色相と鮮やかさは保つ）
 */

export type PalettePattern = 'complementary' | 'triadic' | 'tetradic' | 'monochromatic' | 'tint'

export interface CustomPalette {
  base: string
  pattern: PalettePattern
}

/** 標準の配色（index.css の「夜明けの川」）の基調色 */
export const DEFAULT_BASE = '#3E3A78'

const STORAGE_KEY = 'river-palette'
const STYLE_ID = 'river-custom-palette'

/** OKLCH: L は 0〜1、C は 0〜0.37 くらい、H は 0〜360 */
type Lch = [l: number, c: number, h: number]

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const rotate = (h: number, deg: number) => (h + deg + 360) % 360
/** a から見た b の色相の差（-180〜180） */
const hueDiff = (a: number, b: number) => ((b - a + 540) % 360) - 180

export function isHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

// ─── 色空間の変換（sRGB ⇔ OKLab ⇔ OKLCH） ─────────────────────────

const toLinear = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
const fromLinear = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)

function hexToLch(hex: string): Lch {
  const [r, g, b] = [1, 3, 5].map(i => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360]
}

/** OKLCH → 線形 sRGB（範囲外の値もそのまま返す） */
function lchToLinear([L, C, H]: Lch): [number, number, number] {
  const a = C * Math.cos(H * Math.PI / 180)
  const b = C * Math.sin(H * Math.PI / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ]
}

const inGamut = (lch: Lch) => lchToLinear(lch).every(v => v >= -0.0001 && v <= 1.0001)

/** その明るさ・色相で画面に出せるいちばん鮮やかな C */
function maxChroma(L: number, H: number): number {
  let lo = 0
  let hi = 0.4
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (inGamut([L, mid, H])) lo = mid
    else hi = mid
  }
  return lo
}

/** OKLCH → HEX。画面に出せない鮮やかさは、色相と明るさを保ったまま鮮やかさだけ落とす */
function lchToHex([L, C, H]: Lch): string {
  const l = clamp(L, 0, 1)
  const c = Math.min(C, maxChroma(l, H))
  return '#' + lchToLinear([l, c, H])
    .map(v => Math.round(clamp(fromLinear(clamp(v, 0, 1)), 0, 1) * 255).toString(16).padStart(2, '0'))
    .join('').toUpperCase()
}

/** その色相がいちばん鮮やかに出せる明るさ（黄色は明るく、青は暗い） */
function cuspLightness(H: number): number {
  let best = 0.6
  let bestC = 0
  for (let L = 0.3; L <= 0.95; L += 0.01) {
    const c = maxChroma(L, H)
    if (c > bestC) { bestC = c; best = L }
  }
  return best
}

// ─── コントラスト ───────────────────────────────────────

function luminance(hex: string): number {
  const c = [1, 3, 5].map(i => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** どの背景に対してもコントラストが target 以上になるまで、明るさだけを動かす（dir: -1 で暗く、+1 で明るく） */
function fit([L, C, H]: Lch, against: string[], target: number, dir: -1 | 1): string {
  let l = L
  const ok = () => against.every(bg => contrast(lchToHex([l, C, H]), bg) >= target)
  while (!ok() && l > 0 && l < 1) l += dir * 0.005
  return lchToHex([clamp(l, 0, 1), C, H])
}

/**
 * その色の上に載せる文字色。白と、同じ色みの濃い色のうちコントラストが高いほう
 * （ヘッダーでは補足の文字を半透明で重ねるので、余裕のあるほうを選ぶ）
 */
function textOn(bg: string, hue: number, chroma: number): string {
  const dark = lchToHex([0.2, Math.min(chroma, 0.03), hue])
  return contrast('#FFFFFF', bg) >= contrast(dark, bg) ? '#FFFFFF' : dark
}

/**
 * 文字を載せる面（ヘッダー・主ボタン）。選んだ色をそのまま使い、白でも黒でも 4.5:1 に届かない
 * 中間の明るさのときだけ、文字色から離れる向きに明るさをほんの少し動かす（色相・鮮やかさは保つ）
 */
function surfaceWithText(hex: string): { surface: string; on: string } {
  const [L, C, H] = hexToLch(hex)
  const on = textOn(hex, H, C)
  if (contrast(on, hex) >= 4.5) return { surface: hex.toUpperCase(), on }
  const surface = fit([L, C, H], [on], 4.5, on === '#FFFFFF' ? -1 : 1)
  return { surface, on }
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ─── 配色を作る ─────────────────────────────────────────

/** 配色パターンが使う色相（先頭が選んだ色）。参考ツールと同じ回し方 */
function patternHues(H: number, pattern: PalettePattern): number[] {
  switch (pattern) {
    case 'complementary': return [H, rotate(H, 180)]
    case 'triadic': return [H, rotate(H, 120), rotate(H, 240)]
    case 'tetradic': return [H, rotate(H, 90), rotate(H, 180), rotate(H, 270)]
    default: return [H] // ティント・モノクロマティックは同じ色相の濃淡
  }
}

/** 人の目で見た色の差（CIE76 の ΔE。おおむね 20 以上あれば別の色として見分けやすい） */
function deltaE(a: string, b: string): number {
  const lab = (hex: string) => {
    const c = [1, 3, 5].map(i => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255))
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
    const x = f((c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047)
    const y = f(c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722)
    const z = f((c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883)
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
  }
  const [p, q] = [lab(a), lab(b)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

const hueDistance = (a: number, b: number) => Math.abs(hueDiff(a, b))

/** ステータスの「意味の色相」。パターンの色をどのステータスに割り当てるかの目安にする */
const STATUS_ANCHORS = { progress: 240, done: 150, submitted: 315 } as const
type StatusKey = keyof typeof STATUS_ANCHORS
const STATUS_KEYS = Object.keys(STATUS_ANCHORS) as StatusKey[]
/** 期限切れの赤。警告なので、パターンの色へは少しだけ寄せる */
const RED = 27

/** ステータス 1 つ分の色の素（色相・鮮やかさ、ライトの文字と背景の明るさ、ダークの文字の明るさ） */
interface StatusSpec { h: number; c: number; textL: number; bgL: number; darkL: number }

/**
 * パターンの色を、進行中・完了・提出済みに割り当てる。
 * - 色が 3 つ以上あれば別々の色を、意味の色相にいちばん近くなる組み合わせで割り当てる
 * - 足りなければ同じ色を共有し、進むほど濃くする（進行中 → 完了 → 提出済み）
 */
function assignStatusHues(pool: number[]): Record<StatusKey, { h: number; step: number }> {
  const cost = (h: number, key: StatusKey) => hueDistance(h, STATUS_ANCHORS[key])
  const result = {} as Record<StatusKey, { h: number; step: number }>
  if (pool.length >= 3) {
    let best: number[] = []
    let bestCost = Infinity
    for (const a of pool) for (const b of pool) for (const c of pool) {
      if (a === b || b === c || a === c) continue
      const total = cost(a, 'progress') + cost(b, 'done') + cost(c, 'submitted')
      if (total < bestCost) { bestCost = total; best = [a, b, c] }
    }
    STATUS_KEYS.forEach((key, i) => { result[key] = { h: best[i], step: -1 } })
    return result
  }
  for (const key of STATUS_KEYS) {
    const h = pool.reduce((x, y) => (cost(y, key) < cost(x, key) ? y : x))
    result[key] = { h, step: -1 }
  }
  // 同じ色を共有するステータスには、進み具合の順に濃さの段階をつける
  for (const h of new Set(STATUS_KEYS.map(k => result[k].h))) {
    const group = STATUS_KEYS.filter(k => result[k].h === h)
    if (group.length > 1) group.forEach((k, i) => { result[k].step = group.length === 2 ? i * 2 : i })
  }
  return result
}

function buildStatus(base: Lch, pattern: PalettePattern, lightBg: string, darkBg: string, darkSurface: string) {
  const [, C0, H0] = base
  const chromatic = C0 >= 0.03
  // ティントは白を混ぜたやわらかい色、それ以外は選んだ色の鮮やかさに合わせる
  const chroma = chromatic ? (pattern === 'tint' ? clamp(C0 * 0.6, 0.06, 0.1) : clamp(C0, 0.09, 0.16)) : 0.07
  const bgChroma = pattern === 'tint' ? 0.035 : 0.05

  const hues = chromatic ? patternHues(H0, pattern) : Object.values(STATUS_ANCHORS)
  // 赤（期限切れ）に近いパターンの色はステータスに使わない（警告と見間違えるため）。
  // 全部が赤に近い（赤やオレンジでティント・モノクロなど）ときは、選んだ色の隣の色相を
  // 赤から離れる向きに 50° 回して使う（オレンジ → 金 → 黄緑 のように、選んだ色の近所でまとめる）
  const usable = hues.filter(h => hueDistance(h, RED) >= 45)
  const pool = usable.length > 0
    ? usable
    : [rotate(H0, 50 * (Math.sign(hueDiff(RED, H0)) || 1))]
  const assigned = assignStatusHues(pool)

  // 濃さの段階（同じ色を共有するときだけ使う）: 0 = 明るい、1 = 中くらい、2 = 濃い
  const LEVELS = [
    { textL: 0.58, bgL: 0.965, darkL: 0.9, dh: -28 },
    { textL: 0.46, bgL: 0.93, darkL: 0.8, dh: 0 },
    { textL: 0.36, bgL: 0.895, darkL: 0.7, dh: 28 },
  ]
  const specs: Record<string, StatusSpec> = {}
  for (const key of STATUS_KEYS) {
    const { h, step } = assigned[key]
    const level = step >= 0 ? LEVELS[step] : { textL: 0.52, bgL: 0.955, darkL: 0.8, dh: 0 }
    // 赤に近い色（90° 以内）は、両側に振ると片方が赤に寄るので、赤から離れる向きにだけ振る
    const away = Math.sign(hueDiff(RED, h)) || 1
    const dh = hueDistance(h, RED) >= 90 ? level.dh : away * (level.dh + 28)
    specs[key] = { h: rotate(h, dh), c: chroma, textL: level.textL, bgL: level.bgL, darkL: level.darkL }
  }
  // 期限切れは赤のまま、パターンのいちばん近い色へ最大 20° だけ寄せる。
  // ただし、ほかのステータスの色から 45° 以上離れている範囲まで
  const nearest = hues.reduce((x, y) => (hueDistance(y, RED) < hueDistance(x, RED) ? y : x))
  let overdueH = chromatic ? rotate(RED, clamp(hueDiff(RED, nearest) * 0.5, -20, 20)) : RED
  const statusHues = STATUS_KEYS.map(k => specs[k].h)
  while (statusHues.some(h => hueDistance(h, overdueH) < 45) && hueDistance(overdueH, RED) >= 2) {
    overdueH = rotate(overdueH, 2 * Math.sign(hueDiff(overdueH, RED)))
  }
  specs.overdue = { h: overdueH, c: Math.max(chroma, 0.13), textL: 0.52, bgL: 0.955, darkL: 0.8 }
  // 未着手は画面の地の色（選んだ色をうっすら含むグレー）
  const neutralC = chromatic ? Math.min(C0 * 0.15, 0.015) : 0
  specs.todo = { h: H0, c: neutralC, textL: 0.5, bgL: 0.955, darkL: 0.8 }

  const render = (s: StatusSpec, key: string) => {
    const bgC = key === 'todo' ? 0 : bgChroma
    const bg = lchToHex([s.bgL, bgC, s.h])
    const darkBgTint = lchToHex([0.29, bgC, s.h])
    return {
      text: fit([s.textL, s.c, s.h], ['#FFFFFF', bg, lightBg], 4.5, -1),
      bg,
      darkText: fit([s.darkL, Math.min(s.c, 0.13), s.h], [darkSurface, darkBg, darkBgTint], 4.5, 1),
      darkBg: darkBgTint,
    }
  }

  // 未着手・期限切れを先に置き、残りは近すぎる色があれば濃さ → 色相の順に動かして離す
  type Rendered = ReturnType<typeof render> & { h: number }
  const placed: Rendered[] = []
  const tooClose = (r: Rendered) => placed.find(p =>
    deltaE(p.text, r.text) < 20 || deltaE(p.darkText, r.darkText) < 20 || deltaE(p.bg, r.bg) < 4.5)
  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}
  for (const key of ['todo', 'overdue', ...STATUS_KEYS]) {
    let s = { ...specs[key] }
    let r: Rendered = { ...render(s, key), h: s.h }
    let dir = 0
    for (let tries = 0; tries < 30 && key !== 'todo' && key !== 'overdue'; tries++) {
      const conflict = tooClose(r)
      if (!conflict) break
      if (tries < 3 && s.textL > 0.33 && s.darkL > 0.67) {
        // まず濃さで離す（パターンの色相を保つ）。暗くしすぎると黒に近づくので下限を設ける
        s = { ...s, textL: s.textL - 0.035, bgL: s.bgL - 0.012, darkL: s.darkL - 0.03 }
      } else {
        // それでも近ければ、期限切れの赤に近づかない向きに色相を回す
        // 向きは最初に決めたら変えない（赤の手前で行ったり来たりしないように）
        if (dir === 0) dir = Math.sign(hueDiff(conflict.h, s.h)) || 1
        if (hueDistance(rotate(s.h, 10 * dir), overdueH) < 45) dir = -dir
        s = { ...s, h: rotate(s.h, 10 * dir) }
      }
      r = { ...render(s, key), h: s.h }
    }
    placed.push(r)
    light[`--st-${key}`] = r.text
    light[`--st-${key}-bg`] = r.bg
    dark[`--st-${key}`] = r.darkText
    dark[`--st-${key}-bg`] = r.darkBg
  }

  // 期限切れ・完了・提出済みと同じ色を、エラー表示や共有タグにも使う
  for (const set of [light, dark]) {
    Object.assign(set, {
      '--danger': set['--st-overdue'], '--danger-bg': set['--st-overdue-bg'],
      '--public': set['--st-done'], '--public-bg': set['--st-done-bg'],
      '--share': set['--st-submitted'], '--share-bg': set['--st-submitted-bg'],
    })
  }
  return { light, dark }
}

/**
 * アクセントの色
 * - ティント    : 選んだ色そのもの
 * - モノクロ    : 選んだ色の明るさだけを変えたもの
 * - 補色・トライアド・テトラード: パターンのほかの色（赤からいちばん遠いもの）を、その色相がいちばんきれいに出る明るさで
 */
function accentOf(base: Lch, baseHex: string, pattern: PalettePattern): string {
  const [L0, C0, H0] = base
  if (pattern === 'tint') return baseHex.toUpperCase()
  if (pattern === 'monochromatic') return lchToHex([L0 < 0.6 ? L0 + 0.2 : L0 - 0.2, Math.max(C0, 0.06), H0])
  // 無彩色を選んだときは色相に意味がないので、標準のコーラルの色相を使う。
  // トライアド・テトラードは候補が複数あるので、期限切れの赤といちばん離れた色を選ぶ（警告と見間違えないように）
  const candidates = patternHues(H0, pattern).slice(1)
  const h = C0 >= 0.03
    ? candidates.reduce((x, y) => (hueDistance(y, RED) > hueDistance(x, RED) ? y : x))
    : 40
  const l = clamp(cuspLightness(h), 0.6, 0.8)
  // 鮮やかさは選んだ色に合わせつつ、アクセントとして目に留まるよう下限を設ける
  return lchToHex([l, clamp(C0 * 1.2, 0.13, 0.2), h])
}

/** 選んだ 1 色から CSS 変数の値を作る */
function buildPalette({ base: baseHex, pattern }: CustomPalette) {
  const base = hexToLch(baseHex)
  const [, C0, H0] = base
  const chromatic = C0 >= 0.03
  /** 背景や文字に混ぜる、ごく薄い色み */
  const cN = chromatic ? Math.min(C0 * 0.12, 0.012) : 0
  const tone = (l: number, c = cN): string => lchToHex([l, c, H0])

  const lightBg = tone(0.975)
  const darkBg = tone(0.16)
  const darkSurface = tone(0.215)

  // ヘッダーは選んだ色そのまま。文字色のほうを白か黒に切り替える
  const { surface: header, on: onBrand } = surfaceWithText(baseHex)
  const headerL = hexToLch(header)[0]
  const deeper = lchToHex([headerL + (onBrand === '#FFFFFF' ? -0.05 : 0.03), C0, H0])
  const brandDeep = contrast(onBrand, deeper) >= 4.5 ? deeper : header

  const { surface: accent, on: onAccent } = surfaceWithText(accentOf(base, baseHex, pattern))
  const accentLch = hexToLch(accent)
  const accentDeeper = lchToHex([accentLch[0] + (onAccent === '#FFFFFF' ? -0.04 : 0.03), accentLch[1], accentLch[2]])

  const shared = {
    '--brand-header': header,
    '--brand-deep': brandDeep,
    '--on-brand': onBrand,
    '--hero-1': lchToHex([0.2, Math.min(C0, 0.08), H0]),
    '--hero-3': lchToHex([0.26, Math.min(C0, 0.09), H0]),
    '--accent-solid': accent,
    '--accent-solid-2': contrast(onAccent, accentDeeper) >= 4.5 ? accentDeeper : accent,
    '--on-accent': onAccent,
  }

  const lightBrand = fit(base, [lightBg], 4.5, -1)
  const light = {
    '--brand': lightBrand,
    '--brand-soft': lchToHex([0.95, Math.min(C0, 0.04), H0]),
    '--water': lchToHex([0.65, Math.min(Math.max(C0, 0.08), 0.12), patternHues(H0, pattern)[1] ?? H0]),
    '--saturday': lightBrand,
    '--bg': lightBg,
    '--bg-secondary': tone(0.945),
    '--surface': '#FFFFFF',
    '--surface-warm': tone(0.988, cN * 0.6),
    '--text-primary': tone(0.22, cN * 1.5),
    '--text-secondary': fit([0.42, cN, H0], [lightBg], 7, -1),
    '--text-tertiary': fit([0.53, cN, H0], [lightBg], 4.5, -1),
    '--text-disabled': tone(0.72),
    '--border': tone(0.885, cN * 1.3),
    '--border-light': tone(0.925),
    '--border-strong': tone(0.76),
    '--accent': accent,
    '--accent-dark': fit(accentLch, [lightBg, '#FFFFFF'], 4.5, -1),
    '--accent-bg': rgba(accent, 0.12),
    '--accent-muted': rgba(accent, 0.24),
    '--header-glass': rgba(lightBg, 0.9),
    '--filter-glass': rgba(lightBg, 0.72),
  }

  const darkBrand = fit([0.78, Math.min(C0, 0.12), H0], [darkSurface, darkBg], 4.5, 1)
  const darkAccent = fit([Math.max(accentLch[0], 0.72), accentLch[1], accentLch[2]], [darkSurface, darkBg], 4.5, 1)
  const dark = {
    '--brand': darkBrand,
    '--brand-soft': rgba(darkBrand, 0.16),
    '--water': lchToHex([0.75, Math.min(Math.max(C0, 0.08), 0.12), patternHues(H0, pattern)[1] ?? H0]),
    '--saturday': darkBrand,
    '--bg': darkBg,
    '--bg-secondary': tone(0.19),
    '--surface': darkSurface,
    '--surface-warm': tone(0.25),
    '--text-primary': tone(0.95, cN * 0.6),
    '--text-secondary': tone(0.82),
    '--text-tertiary': fit([0.68, cN, H0], [darkSurface, darkBg], 4.5, 1),
    '--text-disabled': tone(0.45),
    '--border': tone(0.32),
    '--border-light': tone(0.27),
    '--border-strong': tone(0.4),
    '--accent': darkAccent,
    '--accent-dark': darkAccent,
    '--accent-bg': rgba(darkAccent, 0.16),
    '--accent-muted': rgba(darkAccent, 0.26),
    '--header-glass': rgba(darkBg, 0.9),
    '--filter-glass': rgba(darkBg, 0.72),
  }

  const status = buildStatus(base, pattern, lightBg, darkBg, darkSurface)
  return { shared, light: { ...light, ...status.light }, dark: { ...dark, ...status.dark } }
}

/**
 * 設定画面のプレビュー用の 5 色（参考ツールと同じ並び）
 * 補色: 明るく・選んだ色・暗く・補色・補色を明るく / トライアド: 選んだ色・明るく・120°・120° を暗く・240°
 * テトラード: 選んだ色・90°・180°・270°・暗く / モノクロ: 明るさ 5 段階 / ティント: 白を混ぜた 3 段階・選んだ色・少し暗く
 */
export function previewSwatches({ base, pattern }: CustomPalette): string[] {
  const lch = hexToLch(base)
  const [L, C, H] = lch
  const at = (dl: number, h = H) => lchToHex([clamp(L + dl, 0, 1), C, h])
  const hues = patternHues(H, pattern)
  switch (pattern) {
    case 'complementary': {
      const accent = hexToLch(accentOf(lch, base, pattern))
      return [at(0.12), base.toUpperCase(), at(-0.1), lchToHex(accent), lchToHex([accent[0] + 0.1, accent[1] * 0.7, accent[2]])]
    }
    case 'triadic':
      return [base.toUpperCase(), at(0.12), at(0, hues[1]), at(-0.1, hues[1]), at(0, hues[2])]
    case 'tetradic':
      return [base.toUpperCase(), at(0, hues[1]), at(0, hues[2]), at(0, hues[3]), at(-0.12)]
    case 'monochromatic':
      return [at(0.3), at(0.15), base.toUpperCase(), at(-0.12), at(-0.24)]
    default: {
      // ティントは白を混ぜるように、明るくしながら鮮やかさも少しずつ落とす
      const tintOf = (t: number) => lchToHex([L + (0.98 - L) * t, C * (1 - t * 0.85), H])
      return [tintOf(0.75), tintOf(0.5), tintOf(0.25), base.toUpperCase(), at(-0.08)]
    }
  }
}

const block = (selector: string, vars: Record<string, string>) =>
  `${selector} {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`

/** 配色を画面に当てる。null なら標準（index.css の「夜明けの川」）に戻す */
export function applyPalette(palette: CustomPalette | null) {
  const root = document.documentElement
  document.getElementById(STYLE_ID)?.remove()
  if (!palette || !isHex(palette.base)) {
    root.removeAttribute('data-custom-palette')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', DEFAULT_BASE)
    return
  }
  const { shared, light, dark } = buildPalette(palette)
  const style = document.createElement('style')
  style.id = STYLE_ID
  // index.css の :root / [data-theme="dark"] より詳細度を高くして上書きする
  style.textContent = [
    block('html[data-custom-palette]', shared),
    block('html[data-custom-palette]:not([data-theme="dark"])', light),
    block('html[data-custom-palette][data-theme="dark"]', dark),
  ].join('\n')
  document.head.appendChild(style)
  root.setAttribute('data-custom-palette', '')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', shared['--brand-header'])
}

export function getStoredPalette(): CustomPalette | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CustomPalette>
    if (typeof parsed.base !== 'string' || !isHex(parsed.base)) return null
    const patterns: PalettePattern[] = ['complementary', 'triadic', 'tetradic', 'monochromatic', 'tint']
    const pattern = patterns.find(x => x === parsed.pattern) ?? 'complementary'
    return { base: parsed.base, pattern }
  } catch {
    return null
  }
}

export function storePalette(palette: CustomPalette | null) {
  try {
    if (palette) localStorage.setItem(STORAGE_KEY, JSON.stringify(palette))
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* 保存できなくても、この画面では反映される */ }
}
