import { useState } from 'react'
import Sheet from '../ui/Sheet'
import { Button, Section } from '../ui/kit'
import { SegmentedButton, TextField } from '../ui/m3'
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
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const moonIcon = (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <Button variant="ghost" onClick={() => update(null)} disabled={!palette}>標準の配色に戻す</Button>
          <Button variant="primary" onClick={onClose}>閉じる</Button>
        </div>
      }
    >
      <Section title="表示モード">
        <SegmentedButton
          label="表示モード"
          block
          value={isDark ? 'dark' : 'light'}
          onChange={mode => { if ((mode === 'dark') !== isDark) toggleTheme() }}
          options={[
            { key: 'light', label: 'ライト', icon: sunIcon },
            { key: 'dark', label: 'ダーク', icon: moonIcon },
          ]}
        />
      </Section>

      <Section title="テーマカラー" description="1 色選ぶと、相性のいい色でサイト全体を塗り分けます">
        {/* 一段に並べる。幅が足りないときは丸を縮めて収める（押せる範囲は m3-target で確保） */}
        <div role="radiogroup" aria-label="テーマカラーの候補" style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {PRESETS.map(c => {
            const selected = current.base.toUpperCase() === c && (palette !== null || c === DEFAULT_BASE)
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`色 ${c}`}
                className="m3-state m3-target"
                onClick={() => (c === DEFAULT_BASE && current.pattern === 'complementary' ? update(null) : pickColor(c))}
                style={{
                  flex: '1 1 0', minWidth: 0, maxWidth: 40, aspectRatio: '1', borderRadius: 'var(--shape-full)', background: c, cursor: 'pointer', padding: 0,
                  border: '3px solid var(--surface)',
                  boxShadow: selected ? '0 0 0 2px var(--text-primary)' : '0 0 0 1px var(--border)',
                }}
              />
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <input
            type="color"
            value={current.base}
            onChange={e => pickColor(e.target.value)}
            aria-label="好きな色を選ぶ"
            className="m3-state"
            style={{ width: 56, height: 56, padding: 'var(--space-1)', border: '1px solid var(--border-strong)', borderRadius: 'var(--shape-xs)', background: 'var(--surface)', cursor: 'pointer', flexShrink: 0 }}
          />
          <div style={{ width: 180 }}>
            <TextField
              label="カラーコード"
              value={hexDraft}
              onChange={e => {
                const v = e.target.value.trim()
                setHexDraft(v)
                const hex = v.startsWith('#') ? v : `#${v}`
                if (isHex(hex)) pickColor(hex)
              }}
              placeholder="#3E3A78"
              maxLength={7}
              supportingText="好きな色も選べます"
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />
          </div>
        </div>
      </Section>

      <Section title="配色パターン">
        <div role="radiogroup" aria-label="配色パターン" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {PATTERNS.map(p => {
            const selected = current.pattern === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className="m3-state"
                onClick={() => pickPattern(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--shape-md)', minHeight: 64,
                  border: selected ? '2px solid var(--accent-dark)' : '1px solid var(--border)',
                  background: selected ? 'var(--accent-bg)' : 'var(--surface)', color: 'var(--text-primary)',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', borderRadius: 'var(--shape-sm)', overflow: 'hidden', flexShrink: 0 }}>
                  {previewSwatches({ base: current.base, pattern: p.id }).map((c, i) => (
                    <span key={i} style={{ width: 16, height: 32, background: c }} />
                  ))}
                </span>
                <span>
                  <span style={{ display: 'block', ...typeRole('title-small') }}>{p.label}</span>
                  <span style={{ display: 'block', ...typeRole('body-small'), color: 'var(--text-secondary)' }}>{p.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="課題のステータス" description="テーマカラーと配色パターンに合わせて色が変わります（どの組み合わせでも見分けられるよう自動で調整）">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {(['todo', 'in_progress', 'done', 'submitted', 'overdue'] as const).map(s => (
            <span key={s} style={{
              background: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color, borderLeft: `3px solid ${STATUS_CONFIG[s].color}`,
              borderRadius: 'var(--shape-xs)', padding: 'var(--space-1) var(--space-3)', ...typeRole('label-medium'),
            }}>
              {STATUS_CONFIG[s].label}
            </span>
          ))}
        </div>
      </Section>
    </Sheet>
  )
}

/** 文字の役割（tokens.css の M3 type scale）をインラインスタイルで使う */
function typeRole(role: string): React.CSSProperties {
  return {
    fontSize: `var(--type-${role}-size)`,
    lineHeight: `var(--type-${role}-line)`,
    fontWeight: `var(--type-${role}-weight)`,
    letterSpacing: `var(--type-${role}-tracking)`,
  }
}
