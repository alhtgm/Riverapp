import { Avatar } from '../ui/kit'
import { useStore } from '../../store/useStore'
import { STATUS_CONFIG, type ProgressPerson, type TaskProgress, type TaskStatus } from '../../types'

const MAX_SHOWN = 5

/** 1つのステータスにいる人を並べる（多い場合は先頭数人＋「ほか○人」） */
export function PeopleRow({ people, size = 22 }: { people: ProgressPerson[]; size?: number }) {
  const named = people.filter(p => p.name)
  const shown = named.slice(0, MAX_SHOWN)
  const others = people.length - shown.length
  if (people.length === 0) return <span style={{ fontSize: 11, color: 'var(--text-disabled)' }}>—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
      {shown.map((p, i) => (
        <span key={p.userId ?? i} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <Avatar name={p.name} size={size} />
        </span>
      ))}
      {shown.length === 1 && others === 0 && (
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shown[0].name}
        </span>
      )}
      {others > 0 && (
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: shown.length ? 6 : 0, whiteSpace: 'nowrap' }}>
          {shown.length ? `ほか${others}人` : `${others}人`}
        </span>
      )}
    </span>
  )
}

const ORDER: TaskStatus[] = ['submitted', 'done', 'in_progress', 'todo']

/** 課題ごとに、どのステータスに誰がいるかを並べる（7章） */
export default function ProgressPeople({ progress }: { progress: TaskProgress | undefined }) {
  const isDark = useStore(s => s.isDark)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {ORDER.map(status => {
        const cfg = STATUS_CONFIG[status]
        const people = progress?.[status] ?? []
        return (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? cfg.darkColor : cfg.color, flexShrink: 0, width: 72 }}>
              {cfg.label} {people.length}
            </span>
            <PeopleRow people={people} />
          </div>
        )
      })}
    </div>
  )
}
