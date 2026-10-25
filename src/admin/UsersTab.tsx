import { useCallback, useEffect, useState } from 'react'
import { adminApi, type AdminUser } from '../lib/admin'
import { Avatar, Badge, Button, Card, Confirm, EmptyState, Notice, Section } from '../components/ui/kit'
import { TextField } from '../components/ui/m3'
import { useToast } from '../components/ui/Toast'
import { formatDateTime } from './format'

const PAGE_SIZE = 50

/** ユーザー一覧。表示名・ユーザーIDで探し、利用停止・解除ができる */
export default function UsersTab({ onChanged }: { onChanged: () => void }) {
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [page, setPage] = useState(0)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    adminApi.listUsers(appliedQuery, PAGE_SIZE, page * PAGE_SIZE)
      .then(list => { setUsers(list); setError(null) })
      .catch(e => setError((e as Error).message))
  }, [appliedQuery, page])
  useEffect(() => { load() }, [load])

  // 入力が止まってから探す
  useEffect(() => {
    const t = setTimeout(() => { setAppliedQuery(query.trim()); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [query])

  const total = users?.[0]?.total_count ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Section title="ユーザー" count={total} description="新しく登録した順に並びます。メールアドレスは表示しません">
      <div style={{ maxWidth: 420 }}>
        <TextField label="表示名・ユーザーIDで探す" value={query} onChange={e => setQuery(e.target.value)} placeholder="例: りばー / @abcd2345" type="search" />
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {users && users.length === 0 && <EmptyState compact title="見つかりませんでした" />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {users?.map(u => <UserRow key={u.id} user={u} onChanged={() => { load(); onChanged() }} />)}
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)' }}>
          <Button size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>前へ</Button>
          <span style={{ color: 'var(--text-secondary)' }}>{page + 1} / {pages}</span>
          <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>次へ</Button>
        </div>
      )}
    </Section>
  )
}

function UserRow({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suspended = user.suspended_at !== null

  const apply = async () => {
    setBusy(true); setError(null)
    try {
      await adminApi.setSuspended(user.id, !suspended, reason.trim())
      showToast(suspended ? `${user.display_name}さんの利用停止を解除しました` : `${user.display_name}さんを利用停止にしました`)
      setConfirming(false)
      setReason('')
      onChanged()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Card padding={12} tone={suspended ? 'muted' : 'default'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Avatar name={user.display_name} size={36} />
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{user.display_name}</span>
            <span style={{ color: 'var(--text-secondary)' }}>@{user.handle}</span>
            {user.is_admin && <Badge tone="accent">管理者</Badge>}
            {suspended && <Badge tone="danger">利用停止中</Badge>}
          </div>
          <div style={{ fontSize: 'var(--type-body-small-size)', color: 'var(--text-secondary)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span>登録 {formatDateTime(user.created_at)}</span>
            <span>最終ログイン {formatDateTime(user.last_sign_in_at)}</span>
            <span>講義 {user.lecture_count}</span>
            <span>メッセージ {user.feedback_count}</span>
            {user.school_name && <span>{user.school_name}</span>}
          </div>
          {suspended && (
            <div style={{ fontSize: 'var(--type-body-small-size)', color: 'var(--danger)' }}>
              {formatDateTime(user.suspended_at)} から停止中{user.suspended_reason && `（理由: ${user.suspended_reason}）`}
            </div>
          )}
        </div>
        {!user.is_admin && !confirming && (
          <Button size="sm" variant={suspended ? 'secondary' : 'danger'} onClick={() => setConfirming(true)}>
            {suspended ? '停止を解除' : '利用停止'}
          </Button>
        )}
      </div>
      {confirming && (
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {!suspended && (
            <TextField label="理由（管理者だけが見られます）" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} />
          )}
          <Confirm
            message={suspended ? `${user.display_name}さんの利用停止を解除しますか？` : `${user.display_name}さんを利用停止にしますか？`}
            detail={suspended
              ? 'またログインして使えるようになります。'
              : 'ログインできなくなり、ログイン中の端末も1時間以内にログアウトされます。データは消えず、あとから解除できます。'}
            confirmLabel={suspended ? '解除する' : '利用停止にする'}
            tone={suspended ? 'primary' : 'danger'}
            busy={busy}
            onConfirm={() => void apply()}
            onCancel={() => { setConfirming(false); setError(null) }}
          />
        </div>
      )}
      {error && <div style={{ marginTop: 'var(--space-2)' }}><Notice tone="danger">{error}</Notice></div>}
    </Card>
  )
}
