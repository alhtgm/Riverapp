import { useEffect, useRef, useState } from 'react'
import type { PartyWithCount } from '../../store/useSocialStore'
import { inputStyle } from '../ui/styles'

interface Props {
  /** 自分が所属しているパーティー */
  myParties: PartyWithCount[]
  /** 講義を見せているパーティーの ID（ほかの参加者が選んだものも含む） */
  selectedIds: string[]
  busy: boolean
  onChange: (partyId: string, enabled: boolean) => void
}

/**
 * 講義を見せるパーティーの選択。
 * 選んだパーティーはタグで並べ（× で外す）、追加は検索できるポップオーバーから選ぶ。
 * パーティーが増えてもタグの行が伸びるだけで、画面が一覧で埋まらない。
 */
export default function PartyPicker({ myParties, selectedIds, busy, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const selectedMine = myParties.filter(p => selectedIds.includes(p.id))
  const othersCount = selectedIds.filter(id => !myParties.some(p => p.id === id)).length
  const q = query.trim().toLowerCase()
  const candidates = myParties
    .filter(p => !selectedIds.includes(p.id))
    .filter(p => !q || p.name.toLowerCase().includes(q))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: 8, minHeight: 44,
        border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-warm)',
      }}>
        {selectedMine.map(p => (
          <span key={p.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 4px 4px 10px', borderRadius: 9999,
            background: 'rgba(124,58,237,0.12)', color: '#7233DE', fontSize: 12, fontWeight: 700,
          }}>
            {p.name}
            <span style={{ fontWeight: 500, opacity: 0.75 }}>{p.member_count}人</span>
            <button
              type="button"
              onClick={() => onChange(p.id, false)}
              disabled={busy}
              aria-label={`${p.name}に見せないようにする`}
              style={{
                width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0,
                background: 'rgba(124,58,237,0.18)', color: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        ))}
        {othersCount > 0 && (
          <span
            title="ほかの参加者が選んだパーティーです。そのパーティーのメンバーだけが外せます"
            style={{ padding: '4px 10px', borderRadius: 9999, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}
          >
            ほかの参加者のパーティー {othersCount}件
          </span>
        )}
        {selectedMine.length === 0 && othersCount === 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '0 4px' }}>
            まだどのパーティーにも見せていません
          </span>
        )}
        <button
          type="button"
          onClick={() => { setOpen(o => !o); setQuery('') }}
          disabled={busy || myParties.length === 0}
          style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px',
            borderRadius: 9999, border: '1px dashed var(--border-strong)', background: 'var(--surface)',
            color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          パーティーを追加
        </button>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 'min(320px, 100%)', zIndex: 10,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)',
          padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}
            placeholder="パーティー名で絞り込み"
            style={{ ...inputStyle, padding: '7px 10px', fontSize: 13 }}
          />
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {candidates.length === 0 ? (
              <p style={{ margin: 0, padding: '8px 6px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                {q ? '見つかりません' : 'すべてのパーティーに見せています'}
              </p>
            ) : candidates.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id, true); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 8,
                  border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.member_count}人</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
