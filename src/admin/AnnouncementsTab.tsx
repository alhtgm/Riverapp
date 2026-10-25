import { useCallback, useEffect, useState } from 'react'
import { adminApi, type AdminAnnouncement } from '../lib/admin'
import { Button, Card, Confirm, EmptyState, Notice, Section } from '../components/ui/kit'
import { TextArea, TextField } from '../components/ui/m3'
import { useToast } from '../components/ui/Toast'
import { formatDateTime } from './format'

/** 全員へのお知らせ。送ると利用停止中の人を除く全員の受信箱に届く（取り消しはできない） */
export default function AnnouncementsTab({ usersTotal }: { usersTotal: number | null }) {
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<AdminAnnouncement[] | null>(null)

  const load = useCallback(() => {
    adminApi.listAnnouncements().then(setHistory).catch(e => setError((e as Error).message))
  }, [])
  useEffect(() => { load() }, [load])

  const ready = title.trim() !== '' && body.trim() !== ''

  const send = async () => {
    setBusy(true); setError(null)
    try {
      const count = await adminApi.sendAnnouncement(title.trim(), body.trim())
      showToast(`${count}人にお知らせを送りました`)
      setTitle(''); setBody(''); setConfirming(false)
      load()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <Section title="全員にお知らせを送る" description="メンテナンスや新しい機能のお知らせが、全員の受信箱に届きます（利用停止中の人には届きません）">
        <Card padding={20} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 640 }}>
          <TextField label="見出し" required value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="例: 10/30（木）2:00〜3:00 メンテナンスのお知らせ" />
          <TextArea label="本文" required value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={5} />
          {confirming ? (
            <Confirm
              message={`${usersTotal !== null ? `${usersTotal}人` : '全員'}に送りますか？`}
              detail="送ったお知らせは取り消せません。"
              confirmLabel="送る"
              tone="primary"
              busy={busy}
              onConfirm={() => void send()}
              onCancel={() => setConfirming(false)}
            />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" disabled={!ready} onClick={() => setConfirming(true)}>送る前に確認する</Button>
            </div>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
        </Card>
      </Section>

      <Section title="送ったお知らせ" count={history?.length}>
        {history && history.length === 0 && <EmptyState compact title="まだ送っていません" />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {history?.map(a => (
            <Card key={a.id} padding={16}>
              <div style={{ fontWeight: 600 }}>{a.title}</div>
              <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 'var(--space-1) 0' }}>{a.body}</div>
              <div style={{ fontSize: 'var(--type-body-small-size)', color: 'var(--text-secondary)' }}>
                {formatDateTime(a.created_at)} · {a.sender_name ?? '管理者'} · {a.recipients}人に送信
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </>
  )
}
