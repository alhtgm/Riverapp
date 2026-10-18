import { LIMITS } from '../../lib/limits'
import { useSocialStore } from '../../store/useSocialStore'
import { Badge, Button } from '../ui/kit'
import { usePartyInvites } from './usePartyInvites'

/** 1人を、所属しているパーティーのどれに招待するかを選ぶ行（パーティーごとに状態かボタンを並べる） */
export function InviteToParties({ userId }: { userId: string }) {
  const parties = useSocialStore(s => s.parties)
  const { loaded, stateOf, invite, busy } = usePartyInvites()
  if (parties.length === 0) {
    return <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>パーティーに入ると招待できます</span>
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {parties.map(p => {
        const st = stateOf(p.id, userId)
        const full = p.member_count >= LIMITS.partyMaxMembers
        return (
          <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 4px 4px 10px', border: '1px solid var(--border-light)', borderRadius: 9999, background: 'var(--surface)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
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
