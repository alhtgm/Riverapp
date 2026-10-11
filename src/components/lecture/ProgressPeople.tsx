import { Avatar } from '../ui/Sheet'
import type { TaskProgress } from '../../types'

const MAX_SHOWN = 5

/** 「完了」「取り組み中」の人を並べる（多い場合は先頭数人＋「ほか○人」）。7章 */
export default function ProgressPeople({ progress, compact = false }: { progress: TaskProgress | undefined; compact?: boolean }) {
  const groups = [
    { label: '完了', people: progress?.done ?? [], color: '#14913F' },
    { label: '取り組み中', people: progress?.inProgress ?? [], color: '#0779A0' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: compact ? 'row' : 'column', gap: compact ? 12 : 8, flexWrap: 'wrap' }}>
      {groups.map(g => {
        const named = g.people.filter(p => p.name)
        const shown = named.slice(0, MAX_SHOWN)
        const others = g.people.length - shown.length
        return (
          <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: g.color, flexShrink: 0 }}>
              {g.label} {g.people.length}
            </span>
            {!compact && (
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                {shown.map((p, i) => (
                  <span key={p.userId ?? i} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                    <Avatar name={p.name} size={22} />
                  </span>
                ))}
                {others > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: shown.length ? 6 : 0 }}>
                    {shown.length ? `ほか${others}人` : `${others}人`}
                  </span>
                )}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
