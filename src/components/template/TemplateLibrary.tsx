import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useToast } from '../ui/Toast'

interface Props {
  onClose: () => void
}

export default function TemplateLibrary({ onClose }: Props) {
  const { templates, fetchTemplates, importTemplate, createTemplateFromSubject, deleteTemplate, subjects, profile } = useStore()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [publishSubjectId, setPublishSubjectId] = useState('')
  const [publishDesc, setPublishDesc] = useState('')
  const [publishProfessor, setPublishProfessor] = useState('')
  const [publishDepartment, setPublishDepartment] = useState('')
  const [publishSchedule, setPublishSchedule] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchTemplates().finally(() => setLoading(false))
  }, [fetchTemplates])

  const handleImport = async (id: string) => {
    setBusyId(id)
    try {
      await importTemplate(id)
      showToast('テンプレートを取り込みました')
      onClose()
    } catch (e: unknown) {
      showToast((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？（取り込み済みの課題は消えません）')) return
    setBusyId(id)
    try {
      await deleteTemplate(id)
      showToast('テンプレートを削除しました')
    } catch (e: unknown) {
      showToast((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const resetPublish = () => {
    setShowPublish(false)
    setPublishSubjectId('')
    setPublishDesc('')
    setPublishProfessor('')
    setPublishDepartment('')
    setPublishSchedule('')
  }

  const handlePublish = async () => {
    if (!publishSubjectId) return
    setPublishing(true)
    try {
      await createTemplateFromSubject(publishSubjectId, {
        description: publishDesc,
        professor: publishProfessor,
        department: publishDepartment,
        schedule: publishSchedule,
      })
      showToast('テンプレートを公開しました')
      resetPublish()
    } catch (e: unknown) {
      showToast((e as Error).message)
    } finally {
      setPublishing(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-warm)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 14,
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
  }

  const q = query.trim().toLowerCase()
  const mineCount = templates.filter(t => profile?.id != null && t.created_by === profile.id).length
  const visibleTemplates = templates.filter(t => {
    if (tab === 'mine' && !(profile?.id != null && t.created_by === profile.id)) return false
    if (!q) return true
    return [t.title, t.creator_name, t.description, t.professor, t.department, t.schedule]
      .some(v => (v ?? '').toLowerCase().includes(q))
  })

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    background: active ? 'var(--accent-bg)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    border: `1px solid ${active ? 'var(--accent-muted)' : 'var(--border)'}`,
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  })

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,10,0.3)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', zIndex: 200 }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 24px 64px rgba(20,16,10,0.14), 0 8px 20px rgba(20,16,10,0.07)',
        zIndex: 210,
        width: 'min(560px, calc(100vw - 32px))',
        maxHeight: 'calc(100svh - 48px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: 'var(--surface)',
          zIndex: 1,
          borderRadius: '16px 16px 0 0',
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
              テンプレート
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '3px 0 0' }}>
              {profile?.school_id ? '同じ学校で共有された講義を取り込めます' : '学校が未設定です'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Publish own subject */}
          {!showPublish ? (
            <button
              onClick={() => setShowPublish(true)}
              disabled={subjects.length === 0}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px dashed var(--border)',
                borderRadius: 10,
                padding: '11px 14px',
                fontSize: 13,
                fontWeight: 600,
                color: subjects.length === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                cursor: subjects.length === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              ＋ 自分の科目をテンプレートとして公開
            </button>
          ) : (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>テンプレートとして公開</div>
              <select
                value={publishSubjectId}
                onChange={e => setPublishSubjectId(e.target.value)}
                style={inputStyle}
              >
                <option value="">科目を選択...</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={publishProfessor}
                  onChange={e => setPublishProfessor(e.target.value)}
                  placeholder="教授名（任意）"
                  style={inputStyle}
                  maxLength={40}
                />
                <input
                  type="text"
                  value={publishSchedule}
                  onChange={e => setPublishSchedule(e.target.value)}
                  placeholder="時間割（例: 月3限）"
                  style={inputStyle}
                  maxLength={30}
                />
              </div>
              <input
                type="text"
                value={publishDepartment}
                onChange={e => setPublishDepartment(e.target.value)}
                placeholder="学科名（任意）例: 情報工学科"
                style={inputStyle}
                maxLength={40}
              />
              <input
                type="text"
                value={publishDesc}
                onChange={e => setPublishDesc(e.target.value)}
                placeholder="説明（任意）例: 2026年前期"
                style={inputStyle}
                maxLength={100}
              />
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>
                同名の講義でも教授・時間割・学科で見分けられます。作成者名（{profile?.display_name}）が表示されます。
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handlePublish}
                  disabled={!publishSubjectId || publishing}
                  style={{
                    flex: 1,
                    background: (!publishSubjectId || publishing) ? 'var(--text-tertiary)' : 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
                    color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600,
                    cursor: (!publishSubjectId || publishing) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {publishing ? '公開中...' : '公開する'}
                </button>
                <button
                  onClick={resetPublish}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  やめる
                </button>
              </div>
            </div>
          )}

          <div style={{ height: 1, background: 'var(--border-light)', margin: '2px 0' }} />

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={tabStyle(tab === 'all')} onClick={() => setTab('all')}>
              みんなのテンプレート
            </button>
            <button style={tabStyle(tab === 'mine')} onClick={() => setTab('mine')}>
              自分の公開（{mineCount}）
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="🔍 講義名・作成者・説明で検索"
            style={inputStyle}
          />

          {/* Template list */}
          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>読み込み中...</div>
          ) : visibleTemplates.length === 0 ? (
            <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1.7 }}>
              {q
                ? '該当するテンプレートがありません。'
                : tab === 'mine'
                  ? 'まだ公開したテンプレートはありません。\n上の「＋」から公開できます。'.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)
                  : <>まだテンプレートがありません。<br />最初の1つを公開してみましょう。</>}
            </div>
          ) : (
            visibleTemplates.map(t => {
              const mine = profile?.id != null && t.created_by === profile.id
              return (
                <div key={t.id} style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: t.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </div>
                    {[t.professor, t.schedule, t.department].some(Boolean) && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[t.professor, t.schedule, t.department].filter(Boolean).join(' ・ ')}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {t.item_count}件の課題 ・ {t.import_count}人が取り込み
                      {t.creator_name ? ` ・ ${t.creator_name}` : ''}
                      {t.description ? ` ・ ${t.description}` : ''}
                    </div>
                  </div>
                  {mine && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={busyId === t.id}
                      aria-label="削除"
                      title="削除"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0, padding: 4 }}
                    >
                      🗑
                    </button>
                  )}
                  <button
                    onClick={() => handleImport(t.id)}
                    disabled={busyId === t.id}
                    style={{
                      background: busyId === t.id ? 'var(--text-tertiary)' : 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
                      color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600,
                      cursor: busyId === t.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', flexShrink: 0,
                    }}
                  >
                    {busyId === t.id ? '...' : '取り込む'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
