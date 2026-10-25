import { useCallback, useEffect, useState } from 'react'
import {
  adminApi, FEEDBACK_CATEGORY_LABEL, FEEDBACK_MAX_LENGTH, FEEDBACK_STATUS_LABEL,
  type AdminFeedback, type AdminFeedbackReply, type FeedbackStatus,
} from '../lib/admin'
import { Badge, Button, Card, EmptyState, Notice, Section } from '../components/ui/kit'
import { Chip, SegmentedButton, TextArea } from '../components/ui/m3'
import { useToast } from '../components/ui/Toast'
import { formatDateTime } from './format'

type Filter = FeedbackStatus | 'all'
const FILTERS: Filter[] = ['open', 'in_progress', 'done', 'all']
const STATUS_TONE = { open: 'danger', in_progress: 'info', done: 'success' } as const
const CATEGORY_TONE = { bug: 'danger', request: 'accent', other: 'neutral' } as const

/** 開発者へのメッセージ。左で選んで、右で中身を読み、対応状況・メモ・返事を付ける */
export default function FeedbackTab({ onChanged }: { onChanged: () => void }) {
  const [filter, setFilter] = useState<Filter>('open')
  const [items, setItems] = useState<AdminFeedback[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 返事や状態の変更で絞り込みから外れても、開いている1件は閉じずに出し続ける
  const [selected, setSelected] = useState<AdminFeedback | null>(null)
  const selectedId = selected?.id ?? null

  const load = useCallback(() => {
    adminApi.listFeedback(filter === 'all' ? null : filter)
      .then(list => {
        setItems(list)
        setError(null)
        setSelected(s => (s && list.find(f => f.id === s.id)) ?? s)
      })
      .catch(e => setError((e as Error).message))
  }, [filter])
  useEffect(() => { load() }, [load])

  const refresh = () => { load(); onChanged() }

  return (
    <Section title="開発者へのメッセージ" description="利用者が設定から送ったバグ報告・要望です。返事は送った人の受信箱に届きます">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {FILTERS.map(f => (
          <Chip key={f} selected={filter === f} onClick={() => { setFilter(f); setSelected(null) }}>
            {f === 'all' ? 'すべて' : FEEDBACK_STATUS_LABEL[f]}
          </Chip>
        ))}
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {items && items.length === 0 && <EmptyState compact title="メッセージはありません" />}
          {items?.map(f => (
            <button
              key={f.id}
              type="button"
              className="m3-state"
              onClick={() => setSelected(f)}
              aria-pressed={f.id === selectedId}
              style={{
                textAlign: 'left', cursor: 'pointer', color: 'inherit', padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--shape-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
                border: f.id === selectedId ? '2px solid var(--accent-dark)' : '1px solid var(--border)',
                background: f.id === selectedId ? 'var(--accent-bg)' : 'var(--surface)',
              }}
            >
              <span style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge tone={CATEGORY_TONE[f.category]}>{FEEDBACK_CATEGORY_LABEL[f.category]}</Badge>
                <Badge tone={STATUS_TONE[f.status]}>{FEEDBACK_STATUS_LABEL[f.status]}</Badge>
                {f.reply_count > 0 && <Badge>返事 {f.reply_count}</Badge>}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 'var(--type-body-small-size)', color: 'var(--text-secondary)' }}>{formatDateTime(f.created_at)}</span>
              </span>
              <span style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'pre-wrap' }}>{f.body}</span>
              <span style={{ fontSize: 'var(--type-body-small-size)', color: 'var(--text-secondary)' }}>
                {f.display_name ?? '退会したユーザー'}{f.handle && ` @${f.handle}`}
              </span>
            </button>
          ))}
        </div>
        <div style={{ flex: '1 1 420px', minWidth: 0, position: 'sticky', top: 'var(--space-4)' }}>
          {selected
            ? <FeedbackDetail key={selected.id} item={selected} onChanged={patch => { setSelected(s => s && { ...s, ...patch }); refresh() }} />
            : items && items.length > 0 && <EmptyState compact title="メッセージを選んでください" description="左の一覧から選ぶと、中身と返事の欄が開きます" />}
        </div>
      </div>
    </Section>
  )
}

function FeedbackDetail({ item, onChanged }: { item: AdminFeedback; onChanged: (patch: Partial<AdminFeedback>) => void }) {
  const { showToast } = useToast()
  const [status, setStatus] = useState<FeedbackStatus>(item.status)
  const [note, setNote] = useState(item.admin_note ?? '')
  const [replies, setReplies] = useState<AdminFeedbackReply[]>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState<'save' | 'reply' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadReplies = useCallback(() => {
    adminApi.feedbackReplies(item.id).then(setReplies).catch(e => setError((e as Error).message))
  }, [item.id])
  useEffect(() => { loadReplies() }, [loadReplies])

  const dirty = status !== item.status || note.trim() !== (item.admin_note ?? '')

  const save = async () => {
    setBusy('save'); setError(null)
    try {
      await adminApi.updateFeedback(item.id, status, note)
      showToast('対応状況を保存しました')
      onChanged({ status, admin_note: note.trim() || null })
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  const sendReply = async () => {
    setBusy('reply'); setError(null)
    try {
      await adminApi.replyFeedback(item.id, reply.trim())
      setReply('')
      // 未対応のものは、データベース側で対応中になる
      const nextStatus = item.status === 'open' ? 'in_progress' : item.status
      if (status === 'open') setStatus('in_progress')
      showToast(item.user_id ? '返事を送りました（相手の受信箱に届きます）' : '返事を記録しました')
      loadReplies()
      onChanged({ status: nextStatus, reply_count: item.reply_count + 1 })
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  const context = Object.entries(item.context ?? {}).filter(([, v]) => v !== null && v !== '')

  return (
    <Card padding={20} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <span style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <Badge tone={CATEGORY_TONE[item.category]}>{FEEDBACK_CATEGORY_LABEL[item.category]}</Badge>
          <span style={{ fontSize: 'var(--type-body-small-size)', color: 'var(--text-secondary)' }}>{formatDateTime(item.created_at)}</span>
        </span>
        <span style={{ fontWeight: 600 }}>
          {item.display_name ?? '退会したユーザー'}{item.handle && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> @{item.handle}</span>}
        </span>
      </div>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.7 }}>{item.body}</p>
      {context.length > 0 && (
        <dl style={{
          margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--type-body-small-size)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)',
          padding: 'var(--space-3)', borderRadius: 'var(--shape-sm)',
        }}>
          {context.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{CONTEXT_LABEL[k] ?? k}</dt>
              <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
        <SegmentedButton<FeedbackStatus>
          label="対応状況"
          block
          value={status}
          onChange={setStatus}
          options={(['open', 'in_progress', 'done'] as const).map(s => ({ key: s, label: FEEDBACK_STATUS_LABEL[s] }))}
        />
        <TextArea label="メモ（管理者だけが見られます）" value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={FEEDBACK_MAX_LENGTH} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="sm" loading={busy === 'save'} disabled={!dirty || busy !== null} onClick={() => void save()}>対応状況を保存</Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
        <span style={{ fontWeight: 600 }}>返事</span>
        {replies.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--type-body-medium-size)' }}>まだ返事をしていません</span>}
        {replies.map(r => (
          <div key={r.id} style={{ background: 'var(--accent-bg)', borderRadius: 'var(--shape-md)', padding: 'var(--space-3)' }}>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.body}</div>
            <div style={{ fontSize: 'var(--type-body-small-size)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
              {r.admin_name ?? '管理者'} · {formatDateTime(r.created_at)}
            </div>
          </div>
        ))}
        {item.user_id ? (
          <>
            <TextArea
              label="返事を書く"
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={3}
              maxLength={FEEDBACK_MAX_LENGTH}
              supportingText="送ると相手の受信箱に届きます。未対応のものは対応中になります"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" size="sm" loading={busy === 'reply'} disabled={!reply.trim() || busy !== null} onClick={() => void sendReply()}>返事を送る</Button>
            </div>
          </>
        ) : (
          <Notice>送った人が退会しているので、返事は届けられません</Notice>
        )}
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
    </Card>
  )
}

const CONTEXT_LABEL: Record<string, string> = {
  version: 'バージョン',
  user_agent: 'ブラウザ',
  screen: '画面の大きさ',
  theme: '表示モード',
}
