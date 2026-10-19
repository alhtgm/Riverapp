import { useEffect, useRef, useState } from 'react'
import type { PartyWithCount } from '../../store/useSocialStore'
import { Button, Chip, TextField } from '../ui/m3'

interface Props {
  /** 自分が所属しているパーティー */
  myParties: PartyWithCount[]
  /** 講義を見せているパーティーの ID（ほかの参加者が選んだものも含む） */
  selectedIds: string[]
  busy: boolean
  onChange: (partyId: string, enabled: boolean) => void
}

const smallText: React.CSSProperties = {
  fontSize: 'var(--type-body-small-size)', lineHeight: 'var(--type-body-small-line)', color: 'var(--text-secondary)',
}

/**
 * 講義を見せるパーティーの選択。
 * 選んだパーティーは入力チップで並べ（× で外す）、追加は検索できるメニューから選ぶ。
 * パーティーが増えてもチップの行が伸びるだけで、画面が一覧で埋まらない。
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
        display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', padding: 'var(--space-2)', minHeight: 56,
        border: '1px solid var(--border)', borderRadius: 'var(--shape-md)', background: 'var(--surface-warm)',
      }}>
        {selectedMine.map(p => (
          <Chip
            key={p.id}
            onRemove={() => { if (!busy) onChange(p.id, false) }}
            removeLabel={`${p.name}に見せないようにする`}
            style={{ background: 'var(--share-bg)', color: 'var(--share)', borderColor: 'transparent' }}
          >
            {p.name}
            <span style={{ fontWeight: 400, opacity: 0.8, marginLeft: 'var(--space-1)' }}>{p.member_count}人</span>
          </Chip>
        ))}
        {othersCount > 0 && (
          <span
            title="ほかの参加者が選んだパーティーです。そのパーティーのメンバーだけが外せます"
            style={{
              display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 var(--space-3)', borderRadius: 'var(--shape-sm)',
              background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
              fontSize: 'var(--type-label-large-size)', lineHeight: 'var(--type-label-large-line)', fontWeight: 'var(--type-label-large-weight)',
            }}
          >
            ほかの参加者のパーティー {othersCount}件
          </span>
        )}
        {selectedMine.length === 0 && othersCount === 0 && (
          <span style={{ ...smallText, padding: '0 var(--space-2)' }}>
            まだどのパーティーにも見せていません
          </span>
        )}
        <Button
          variant="outlined"
          size="xs"
          onClick={() => { setOpen(o => !o); setQuery('') }}
          disabled={busy || myParties.length === 0}
          aria-expanded={open}
          aria-haspopup="menu"
          style={{ marginLeft: 'auto' }}
          icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          }
        >
          パーティーを追加
        </Button>
      </div>

      {open && (
        <div className="m3-menu" role="menu" aria-label="見せるパーティーを選ぶ" style={{
          position: 'absolute', top: 'calc(100% + var(--space-1))', right: 0, width: 'min(320px, 100%)', zIndex: 10,
        }}>
          <div style={{ padding: 'var(--space-2) var(--space-3) var(--space-1)', ['--m3-field-bg' as string]: 'var(--surface-warm)' }}>
            <TextField
              label="パーティー名で絞り込み"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}
              background="var(--surface-warm)"
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {candidates.length === 0 ? (
              <p style={{ ...smallText, margin: 0, padding: 'var(--space-3) var(--space-4)' }}>
                {q ? '見つかりません' : 'すべてのパーティーに見せています'}
              </p>
            ) : candidates.map(p => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                className="m3-menu-item m3-state"
                onClick={() => { onChange(p.id, true); setOpen(false) }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={smallText}>{p.member_count}人</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
