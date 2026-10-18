import { useState } from 'react'
import Sheet from '../ui/Sheet'
import { Button, Section } from '../ui/kit'
import { inputStyle } from '../ui/styles'
import { STATUS_CONFIG } from '../../types'
import { useStore } from '../../store/useStore'
import {
  DEFAULT_BASE, applyPalette, getStoredPalette, isHex, previewSwatches, storePalette,
  type CustomPalette, type PalettePattern,
} from '../../lib/palette'

/** 選びやすいように並べておく色（どれを選んでも文字が読めるよう明度は自動で調整される） */
const PRESETS = [
  '#3E3A78', '#1F5FA8', '#167E8C', '#24574A', '#5E7D2E',
  '#B8860B', '#C2571A', '#B83C55', '#8E3B8F', '#4A4A55',
]

const PATTERNS: { id: PalettePattern; label: string; description: string }[] = [
  { id: 'complementary', label: '補色', description: '反対の色をアクセントに。メリハリのある配色' },
  { id: 'triadic', label: 'トライアド', description: '色相環を 3 等分した 3 色。にぎやかでバランスのいい配色' },
  { id: 'tetradic', label: 'テトラード', description: '色相環を 4 等分した 4 色。いちばんカラフルな配色' },
  { id: 'monochromatic', label: 'モノクロマティック', description: '同じ色の明るさ違いだけ。落ち着いて引き締まった配色' },
  { id: 'tint', label: 'ティント', description: '同じ色に白を混ぜた淡い色。やわらかく統一感のある配色' },
]

const sunIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const moonIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M13.5 9.8A5.8 5.8 0 016.2 2.5a5.8 5.8 0 107.3 7.3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)

/** ハンバーガーメニューの「設定」。表示モードと色は選んだらすぐ画面に反映される */
export default function SettingsSheet({ onClose }: { onClose: () => void }) {
  const isDark = useStore(s => s.isDark)
  const toggleTheme = useStore(s => s.toggleTheme)
  const stored = getStoredPalette()
  const [palette, setPalette] = useState<CustomPalette | null>(stored)
  const [hexDraft, setHexDraft] = useState(stored?.base ?? DEFAULT_BASE)

  const current: CustomPalette = palette ?? { base: DEFAULT_BASE, pattern: 'complementary' }

  const update = (next: CustomPalette | null) => {
    setPalette(next)
    applyPalette(next)
    storePalette(next)
    setHexDraft(next?.base ?? DEFAULT_BASE)
  }

  const pickColor = (base: string) => update({ base: base.toUpperCase(), pattern: current.pattern })
  const pickPattern = (pattern: PalettePattern) => update({ base: current.base, pattern })

  return (
    <Sheet
      title="設定"
      subtitle="この端末のブラウザに保存されます"
      onClose={onClose}
      width={480}
      zIndex={320}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <Button onClick={() => update(null)} disabled={!palette}>標準の配色に戻す</Button>
          <Button variant="primary" onClick={onClose}>閉じる</Button>
        </div>
      }
    >
      <Section title="表示モード">
        <div role="radiogroup" aria-label="表示モード" style={{ display: 'flex', gap: 8 }}>
          {([
            { dark: false, label: 'ライト', icon: sunIcon },
            { dark: true, label: 'ダーク', icon: moonIcon },
          ]).map(m => {
            const selected = isDark === m.dark
            return (
              <button
                key={m.label}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => { if (!selected) toggleTheme() }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                  border: selected ? '1.5px solid var(--accent-dark)' : '1px solid var(--border)',
                  background: selected ? 'var(--accent-bg)' : 'var(--surface)',
                  color: selected ? 'var(--accent-dark)' : 'var(--text-secondary)',
                }}
              >
                {m.icon}
                {m.label}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="テーマカラー" description="1 色選ぶと、相性のいい色でサイト全体を塗り分けます">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {PRESETS.map(c => {
            const selected = current.base.toUpperCase() === c && (palette !== null || c === DEFAULT_BASE)
            return (
              <button
                key={c}
                type="button"
                onClick={() => (c === DEFAULT_BASE && current.pattern === 'complementary' ? update(null) : pickColor(c))}
                aria-label={`色 ${c}`}
                aria-pressed={selected}
                style={{
                  width: 32, height: 32, borderRadius: 9999, background: c, cursor: 'pointer',
                  border: '2px solid var(--surface)',
                  boxShadow: selected ? '0 0 0 2px var(--text-primary)' : '0 0 0 1px var(--border)',
                }}
              />
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={current.base}
            onChange={e => pickColor(e.target.value)}
            aria-label="好きな色を選ぶ"
            style={{ width: 44, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}
          />
          <input
            value={hexDraft}
            onChange={e => {
              const v = e.target.value.trim()
              setHexDraft(v)
              const hex = v.startsWith('#') ? v : `#${v}`
              if (isHex(hex)) pickColor(hex)
            }}
            aria-label="カラーコード"
            placeholder="#3E3A78"
            maxLength={7}
            style={{ ...inputStyle, width: 120, fontFamily: 'ui-monospace, monospace' }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>好きな色も選べます</span>
        </div>
      </Section>

      <Section title="配色パターン">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PATTERNS.map(p => {
            const selected = current.pattern === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPattern(p.id)}
                aria-pressed={selected}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
                  border: selected ? '1.5px solid var(--accent-dark)' : '1px solid var(--border)',
                  background: selected ? 'var(--accent-bg)' : 'var(--surface)', color: 'var(--text-primary)',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                  {previewSwatches({ base: current.base, pattern: p.id }).map((c, i) => (
                    <span key={i} style={{ width: 16, height: 28, background: c }} />
                  ))}
                </span>
                <span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{p.label}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)' }}>{p.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="課題のステータス" description="テーマカラーと配色パターンに合わせて色が変わります（どの組み合わせでも見分けられるよう自動で調整）">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(['todo', 'in_progress', 'done', 'submitted', 'overdue'] as const).map(s => (
            <span key={s} style={{
              background: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color, borderLeft: `3px solid ${STATUS_CONFIG[s].color}`,
              borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 700,
            }}>
              {STATUS_CONFIG[s].label}
            </span>
          ))}
        </div>
      </Section>
    </Sheet>
  )
}
