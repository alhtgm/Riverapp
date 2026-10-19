import { LIMITS } from '../../lib/limits'
import { useSocialStore } from '../../store/useSocialStore'
import { Badge, Button } from '../ui/kit'
import { usePartyInvites } from './usePartyInvites'

/** 1人を、所属しているパーティーのどれに招待するかを選ぶ行（パーティーごとに状態かボタンを並べる） */
/** 文字の役割（tokens.css の M3 type scale）をインラインスタイルで使う */
const type = (role: string): React.CSSProperties => ({
  fontSize: `var(--type-${role}-size)`,
  lineHeight: `var(--type-${role}-line)`,
  fontWeight: `var(--type-${role}-weight)`,
  letterSpacing: `var(--type-${role}-tracking)`,
})

export function InviteToParties({ userId }: { userId: string }) {
  const parties = useSocialStore(s => s.parties)
  const { loaded, stateOf, invite, busy } = usePartyInvites()
  if (parties.length === 0) {
    return <span style={{ ...type('body-small'), color: 'var(--text-secondary)' }}>パーティーに入ると招待できます</span>
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
      {parties.map(p => {
        const st = stateOf(p.id, userId)
        const full = p.member_count >= LIMITS.partyMaxMembers
        return (
          <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 40, padding: 'var(--space-1) var(--space-1) var(--space-1) var(--space-3)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)', background: 'var(--surface)' }}>
            <span style={{ ...type('label-large'), color: 'var(--text-primary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            {st === 'member' ? <Badge tone="success">メンバー</Badge>
              : st === 'invited' ? <Badge tone="info">招待中</Badge>
                : st === 'excluded' ? <Badge tone="danger">除外</Badge>
                  : (
                    <Button size="sm" variant="primary"
                      disabled={!loaded || busy || full} title={full ? '満員のため招待できません' : undefined}
                      onClick={() => void invite(p.id, [userId])}>
                      招待
                    </Button>
                  )}
          </span>
        )
      })}
    </div>
  )
}
