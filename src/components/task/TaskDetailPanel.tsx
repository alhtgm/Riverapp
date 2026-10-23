import { useState, useEffect, type CSSProperties } from 'react'
import type { Task, Subject, TaskStatus } from '../../types'
import { STATUS_CONFIG, STATUS_ORDER } from '../../types'
import { useStore } from '../../store/useStore'
import { useToast } from '../ui/Toast'
import ProgressPeople from '../lecture/ProgressPeople'
import { Confirm, Notice, SectionHeader } from '../ui/kit'
import { Button, Chip, IconButton, SegmentedButton, SelectField, Switch, TextArea, TextField } from '../ui/m3'

interface Props {
  task: Task | null
  subjects: Subject[]
  onClose: () => void
  /** 広い画面で、タイムラインの右に並べて出す（背景を暗くせず、タイムラインも操作できる） */
  docked?: boolean
}

/** 文字の役割（tokens.css の M3 type scale）をインラインスタイルで使う */
const type = (role: string, weight?: string): CSSProperties => ({
  fontSize: `var(--type-${role}-size)`,
  lineHeight: `var(--type-${role}-line)`,
  fontWeight: weight ?? `var(--type-${role}-weight)`,
  letterSpacing: `var(--type-${role}-tracking)`,
})

// ---- Markdown renderer ----
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[0].startsWith('**')) {
      parts.push(<strong key={i++}>{match[2]}</strong>)
    } else if (match[0].startsWith('*')) {
      parts.push(<em key={i++}>{match[3]}</em>)
    } else {
      parts.push(
        <a key={i++} href={match[5]} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent-dark)', textDecoration: 'underline' }}>
          {match[4]}
        </a>
      )
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

function MarkdownPreview({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let key = 0
  const heading: CSSProperties = { margin: 'var(--space-2) 0 var(--space-1)', color: 'var(--text-primary)' }

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} style={{ paddingLeft: 'var(--space-5)', margin: 'var(--space-1) 0' }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ ...type('body-large'), color: 'var(--text-primary)' }}>{item}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      flushList()
      elements.push(<h3 key={key++} style={{ ...heading, ...type('title-small') }}>{renderInline(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      flushList()
      elements.push(<h2 key={key++} style={{ ...heading, ...type('title-medium') }}>{renderInline(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      flushList()
      elements.push(<h1 key={key++} style={{ ...heading, ...type('title-large') }}>{renderInline(line.slice(2))}</h1>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(renderInline(line.slice(2)))
    } else if (line.trim() === '') {
      flushList()
      if (elements.length > 0) elements.push(<div key={key++} style={{ height: 'var(--space-2)' }} />)
    } else {
      flushList()
      elements.push(
        <p key={key++} style={{ margin: '2px 0', ...type('body-large'), color: 'var(--text-primary)' }}>
          {renderInline(line)}
        </p>
      )
    }
  }
  flushList()

  return (
    <div style={{
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--shape-xs)',
      padding: 'var(--space-4)',
      minHeight: 112,
    }}>
      {elements.length > 0
        ? elements
        : <span style={{ ...type('body-large'), color: 'var(--text-tertiary)' }}>プレビューなし</span>}
    </div>
  )
}

const closeIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

/** ステータスの色の点（チップの左に置く） */
const statusDot = (color: string) => (
  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 'var(--shape-full)', background: color, margin: '0 var(--space-1)' }} />
)

export default function TaskDetailPanel({ task, subjects, onClose, docked = false }: Props) {
  const { updateTask, deleteTask, deleteTasksFromRecurrence, updateTasksFromRecurrence, progress } = useStore()
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [memo, setMemo] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [memoTab, setMemoTab] = useState<'edit' | 'preview'>('edit')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showDeleteOptions, setShowDeleteOptions] = useState(false)
  /** 繰り返し課題を以降すべて変更するか */
  const [applyToAll, setApplyToAll] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setSubjectId(task.subject_id)
      setStartDate(task.start_date)
      setDueDate(task.due_date)
      setDueTime(task.due_time ?? '')
      setStatus(task.status)
      setMemo(task.memo ?? '')
      setDescription(task.description ?? '')
      setUrl(task.url ?? '')
      setMemoTab('edit')
      setShowDeleteOptions(false)
      setApplyToAll(false)
    }
  }, [task])

  // Esc で閉じる（ほかの重ねて開く画面と同じ）
  useEffect(() => {
    if (!task) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [task, onClose])

  if (!task) return null

  const handleSave = async () => {
    setErrorMsg('')
    if (!subjectId) { setErrorMsg('講義を選択してください'); return }
    if (!startDate) { setErrorMsg('開始日を入力してください'); return }
    if (!dueDate) { setErrorMsg('締切日を入力してください'); return }
    if (startDate > dueDate) { setErrorMsg('締切日は作業開始日以降に設定してください'); return }
    const trimmedUrl = url.trim()
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) { setErrorMsg('関連URLは http:// か https:// で始めてください'); return }
    setSaving(true)
    try {
      if (applyToAll && task.recurrence_id) {
        // 以降すべてに適用（タイトル・ステータス・メモのみ）
        await updateTasksFromRecurrence(task.recurrence_id, task.due_date, { title, status, memo })
        // この課題の日程・講義・説明は個別更新
        await updateTask(task.id, {
          subject_id: subjectId, start_date: startDate, due_date: dueDate, due_time: dueTime || null,
          description: description.trim() || null, url: trimmedUrl || null,
        })
        showToast('以降すべての課題を更新しました')
      } else {
        await updateTask(task.id, {
          title,
          subject_id: subjectId,
          start_date: startDate,
          due_date: dueDate,
          due_time: dueTime || null,
          description: description.trim() || null,
          url: trimmedUrl || null,
          status,
          memo,
        })
        showToast('課題を保存しました')
      }
      onClose()
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteThis = async () => {
    setErrorMsg('')
    try {
      await deleteTask(task.id)
      showToast('課題を削除しました')
      onClose()
    } catch (e: unknown) { setErrorMsg((e as Error).message) }
  }

  const handleDeleteFromHere = async () => {
    if (!task.recurrence_id) return
    setErrorMsg('')
    try {
      await deleteTasksFromRecurrence(task.recurrence_id, task.due_date)
      showToast('課題を削除しました')
      onClose()
    } catch (e: unknown) { setErrorMsg((e as Error).message) }
  }

  const urlOk = /^https?:\/\//i.test(url.trim())
  const helper: CSSProperties = { ...type('body-small'), color: 'var(--text-secondary)', margin: 0, padding: '0 var(--space-4)' }
  const groupLabel: CSSProperties = { ...type('label-large'), color: 'var(--text-secondary)' }

  return (
    <ModalWrap docked={docked} onClose={onClose}>
      <aside
        className={docked ? 'm3-side-sheet m3-side-sheet--docked' : 'm3-side-sheet'}
        role={docked ? 'complementary' : 'dialog'}
        aria-modal={docked ? undefined : true}
        aria-labelledby="task-detail-title"
        style={docked ? undefined : { zIndex: 160 }}
      >

        <div className="m3-side-sheet__header">
          <h2 id="task-detail-title" style={{ flex: 1, margin: 0, ...type('title-large', 'var(--type-weight-emphasized)') }}>課題の詳細</h2>
          <IconButton label="閉じる" onClick={onClose}>{closeIcon}</IconButton>
        </div>

        <div className="m3-side-sheet__body">
          {errorMsg && <Notice tone="danger">{errorMsg}</Notice>}

          <SectionHeader title="みんなと共有する項目" description="変更すると、この講義の参加者全員に反映されます" />

          <TextField label="タイトル" value={title} onChange={e => setTitle(e.target.value)} />

          <SelectField label="講義" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </SelectField>

          <TextField
            label="締切日"
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            supportingText={dueDate !== task.due_date ? '締切を変更すると、参加者全員に通知されます。' : undefined}
          />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <div style={{ width: 180 }}>
              <TextField label="締切時刻（任意）" type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} />
            </div>
            {dueTime && <Button variant="text" onClick={() => setDueTime('')} style={{ marginTop: 'var(--space-2)' }}>クリア</Button>}
          </div>

          <TextArea
            label="説明（任意）"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="提出方法や範囲など、参加者と共有したいこと"
          />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TextField label="関連URL（任意）" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://" />
            </div>
            {urlOk && (
              <a href={url.trim()} target="_blank" rel="noopener noreferrer" className="m3-btn m3-btn--text m3-state m3-target" style={{ marginTop: 'var(--space-2)', textDecoration: 'none' }}>
                開く
              </a>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <SectionHeader title="みんなの進捗" description="この課題に参加者がいまどのステータスかを表示しています" />
            <ProgressPeople progress={progress[task.id]} />
          </div>

          <SectionHeader title="自分だけの項目" description="ほかの参加者には影響しません（進捗の人数・名前は参加者に表示されます）" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <TextField label="作業開始日" type="date" value={startDate} max={dueDate} onChange={e => setStartDate(e.target.value)} />
            <p style={helper}>
              タイムラインのバーの開始位置です。変えるとあなたにだけ反映され、講義の発生日に戻すとほかの参加者と同じ表示になります。
            </p>
          </div>

          <div role="group" aria-labelledby="task-detail-status" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <span id="task-detail-status" style={groupLabel}>ステータス</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {STATUS_ORDER.map(s => {
                const cfg = STATUS_CONFIG[s]
                const active = status === s
                return (
                  <Chip
                    key={s}
                    selected={active}
                    icon={statusDot(cfg.color)}
                    onClick={() => setStatus(s)}
                    style={active ? { background: cfg.bg, color: cfg.color } : undefined}
                  >
                    {cfg.label}
                  </Chip>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <span style={groupLabel}>メモ</span>
              <SegmentedButton
                label="メモの表示"
                options={[{ key: 'edit', label: '編集' }, { key: 'preview', label: 'プレビュー' }]}
                value={memoTab}
                onChange={setMemoTab}
              />
            </div>
            {memoTab === 'edit' ? (
              <TextArea
                label="内容"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                rows={5}
                placeholder="**太字** *斜体* - リスト [リンク](url) が使えます"
                supportingText="Markdown で書けます"
              />
            ) : (
              <MarkdownPreview text={memo} />
            )}
          </div>
        </div>

        <div className="m3-side-sheet__footer">
          {/* 繰り返し課題: 以降すべてに適用 */}
          {task.recurrence_id && (
            <Switch checked={applyToAll} onChange={setApplyToAll} label="以降すべての課題に適用" />
          )}

          <Button block loading={saving} onClick={handleSave}>
            {saving ? '保存中' : applyToAll ? '以降すべて保存' : '保存'}
          </Button>

          {/* 削除（取り消しは講義の画面の「削除済みの課題」から） */}
          {!showDeleteOptions ? (
            <Button variant="text" danger style={{ alignSelf: 'center' }} onClick={() => setShowDeleteOptions(true)}>
              この課題を削除
            </Button>
          ) : task.recurrence_id ? (
            <div role="alertdialog" aria-labelledby="task-delete-title" style={{
              display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4)',
              borderRadius: 'var(--shape-md)', background: 'var(--danger-bg)',
            }}>
              <span id="task-delete-title" style={{ ...type('title-small'), color: 'var(--text-primary)' }}>繰り返し課題のどこまでを削除しますか？</span>
              <span style={{ ...type('body-medium'), color: 'var(--text-secondary)' }}>参加者全員のRiverから消えます。講義の画面の「削除済みの課題」から元に戻せます。</span>
              <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 'var(--space-1)' }}>
                <Button variant="text" size="xs" onClick={() => setShowDeleteOptions(false)}>やめる</Button>
                <Button variant="tonal" danger size="xs" onClick={handleDeleteThis}>この回だけ</Button>
                <Button variant="filled" danger size="xs" onClick={handleDeleteFromHere}>この回以降すべて</Button>
              </div>
            </div>
          ) : (
            <Confirm
              message="この課題を削除しますか？"
              detail="参加者全員のRiverから消えます。講義の画面の「削除済みの課題」から元に戻せます。"
              confirmLabel="削除する"
              onCancel={() => setShowDeleteOptions(false)}
              onConfirm={handleDeleteThis}
            />
          )}
        </div>
      </aside>
    </ModalWrap>
  )
}

/** 重ねて開くときは背景を暗くする幕で包む。右に並べるときは包まない */
function ModalWrap({ docked, onClose, children }: { docked: boolean; onClose: () => void; children: React.ReactNode }) {
  if (docked) return <>{children}</>
  return (
    <div className="m3-side-wrap" style={{ zIndex: 150 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      {children}
    </div>
  )
}
