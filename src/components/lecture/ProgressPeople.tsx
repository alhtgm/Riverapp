import { Avatar } from '../ui/kit'
import { STATUS_CONFIG, type ProgressPerson, type TaskProgress, type TaskStatus } from '../../types'

const MAX_SHOWN = 5

/** 文字の役割（tokens.css の M3 type scale）をインラインスタイルで使う */
const type = (role: string): React.CSSProperties => ({
  fontSize: `var(--type-${role}-size)`,
  lineHeight: `var(--type-${role}-line)`,
  fontWeight: `var(--type-${role}-weight)`,
  letterSpacing: `var(--type-${role}-tracking)`,
})

/** 1つのステータスにいる人を並べる（多い場合は先頭数人＋「ほか○人」） */
export function PeopleRow({ people, size = 22 }: { people: ProgressPerson[]; size?: number }) {
  const named = people.filter(p => p.name)
  const shown = named.slice(0, MAX_SHOWN)
  const others = people.length - shown.length
  if (people.length === 0) return <span style={{ ...type('body-small'), color: 'var(--text-tertiary)' }}>—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
      {shown.map((p, i) => (
        <span key={p.userId ?? i} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <Avatar name={p.name} size={size} />
        </span>
      ))}
      {shown.length === 1 && others === 0 && (
        <span style={{ ...type('body-small'), color: 'var(--text-secondary)', marginLeft: 'var(--space-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shown[0].name}
        </span>
      )}
      {others > 0 && (
        <span style={{ ...type('body-small'), color: 'var(--text-secondary)', marginLeft: shown.length ? 'var(--space-2)' : 0, whiteSpace: 'nowrap' }}>
          {shown.length ? `ほか${others}人` : `${others}人`}
        </span>
      )}
    </span>
  )
}

const ORDER: TaskStatus[] = ['submitted', 'done', 'in_progress', 'todo']

/** 課題ごとに、どのステータスに誰がいるかを並べる（7章） */
export default function ProgressPeople({ progress }: { progress: TaskProgress | undefined }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {ORDER.map(status => {
        const cfg = STATUS_CONFIG[status]
        const people = progress?.[status] ?? []
        return (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
            <span style={{ ...type('label-medium'), color: cfg.color, flexShrink: 0, width: 80 }}>
              {cfg.label} {people.length}
            </span>
            <PeopleRow people={people} />
          </div>
        )
      })}
    </div>
  )
}
