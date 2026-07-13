import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { useToast } from '../ui/Toast'
import { formatDate, hasTemplateUpdate } from '../../types'
import type { Template, TemplateItem, TemplateItemDraft } from '../../types'

interface Props {
  onClose: () => void
}

type View = 'list' | 'detail' | 'publish' | 'edit'

export default function TemplateLibrary({ onClose }: Props) {
  const {
    templates, fetchTemplates, getTemplateItems, importTemplate,
    createTemplateFromSubject, updateTemplate, applyTemplateUpdate,
    dismissTemplateUpdate, deleteTemplate, subjects, profile,
  } = useStore()
  const { showToast } = useToast()

  const [view, setView] = useState<View>('list')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [query, setQuery] = useState('')

  // detail / edit
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailItems, setDetailItems] = useState<TemplateItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)

  // publish form
  const [pSubjectId, setPSubjectId] = useState('')
  const [pProfessor, setPProfessor] = useState('')
  const [pSchedule, setPSchedule] = useState('')
  const [pDepartment, setPDepartment] = useState('')
  const [pDesc, setPDesc] = useState('')

  // edit form
  const [eTitle, setETitle] = useState('')
  const [eProfessor, setEProfessor] = useState('')
  const [eSchedule, setESchedule] = useState('')
  const [eDepartment, setEDepartment] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [eItems, setEItems] = useState<TemplateItemDraft[]>([])

  const selected = templates.find(t => t.id === selectedId) ?? null
  const isMine = (t: Template) => profile?.id != null && t.created_by === profile.id

  useEffect(() => {
    fetchTemplates().finally(() => setLoading(false))
  }, [fetchTemplates])

  // ---- styles ----
  const input: React.CSSProperties = {
    background: 'var(--surface-warm)', border: '1px solid var(--border)', borderRadius: 8,
    padding: '10px 12px', fontSize: 14, color: 'var(--text-primary)', outline: 'none',
    width: '100%', fontFamily: 'inherit', letterSpacing: '-0.01em',
  }
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: 5, display: 'block' }
  const primaryBtn = (disabled = false): React.CSSProperties => ({
    background: disabled ? 'var(--text-tertiary)' : 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
    color: '#fff', border: 'none', borderRadius: 9, padding: '11px 18px', fontSize: 14, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em',
  })
  const ghostBtn: React.CSSProperties = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 9,
    padding: '11px 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
  }

  // ---- actions ----
  const openDetail = async (id: string) => {
    setSelectedId(id)
    setView('detail')
    setItemsLoading(true)
    try {
      setDetailItems(await getTemplateItems(id))
    } catch (e: unknown) {
      showToast((e as Error).message)
    } finally {
      setItemsLoading(false)
    }
  }

  const openEdit = async (t: Template) => {
    setSelectedId(t.id)
    setETitle(t.title)
    setEProfessor(t.professor ?? '')
    setESchedule(t.schedule ?? '')
    setEDepartment(t.department ?? '')
    setEDesc(t.description ?? '')
    setView('edit')
    setItemsLoading(true)
    try {
      const items = await getTemplateItems(t.id)
      setEItems(items.map(i => ({ id: i.id, title: i.title, start_date: i.start_date, due_date: i.due_date, due_time: i.due_time })))
    } catch (e: unknown) {
      showToast((e as Error).message)
    } finally {
      setItemsLoading(false)
    }
  }

  const handleImport = async (id: string) => {
    setBusy(true)
    try {
      await importTemplate(id)
      showToast('テンプレートを取り込みました')
      onClose()
    } catch (e: unknown) {
      showToast((e as Error).message)
    } finally { setBusy(false) }
  }

  const handleApplyUpdate = async (id: string) => {
    setBusy(true)
    try {
      const r = await applyTemplateUpdate(id)
      showToast(`更新を適用しました（追加${r.added}・変更${r.changed}・削除${r.removed}）`)
      setDetailItems(await getTemplateItems(id))
    } catch (e: unknown) {
      showToast((e as Error).message)
    } finally { setBusy(false) }
  }

  const handleDismiss = async (id: string) => {
    setBusy(true)
    try {
      await dismissTemplateUpdate(id)
      showToast('この更新は適用しません')
    } catch (e: unknown) {
      showToast((e as Error).message)
    } finally { setBusy(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？（取り込み済みの課題は消えません）')) return
    setBusy(true)
    try {
      await deleteTemplate(id)
      showToast('テンプレートを削除しました')
      setView('list')
    } catch (e: unknown) {
      showToast((e as Error).message)
    } finally { setBusy(false) }
  }

  const handlePublish = async () => {
    if (!pSubjectId) return
    setBusy(true)
    try {
      await createTemplateFromSubject(pSubjectId, { professor: pProfessor, schedule: pSchedule, department: pDepartment, description: pDesc })
      showToast('テンプレートを公開しました')
      setPSubjectId(''); setPProfessor(''); setPSchedule(''); setPDepartment(''); setPDesc('')
      setTab('mine'); setView('list')
    } catch (e: unknown) {
      showToast((e as Error).message)
    } finally { setBusy(false) }
  }

  const handleSaveEdit = async () => {
    if (!selectedId) return
    if (eItems.length === 0) { showToast('課題を1つ以上入れてください'); return }
    if (eItems.some(i => !i.title.trim())) { showToast('課題名が空の行があります'); return }
    setBusy(true)
    try {
      await updateTemplate(selectedId, { title: eTitle, professor: eProfessor, schedule: eSchedule, department: eDepartment, description: eDesc }, eItems)
      showToast('更新を公開しました。取り込んだ人に通知されます')
      setView('list')
    } catch (e: unknown) {
      showToast((e as Error).message)
    } finally { setBusy(false) }
  }

  // ---- list filtering ----
  const q = query.trim().toLowerCase()
  const mineCount = templates.filter(isMine).length
  const visible = templates.filter(t => {
    if (tab === 'mine' && !isMine(t)) return false
    if (!q) return true
    return [t.title, t.creator_name, t.description, t.professor, t.department, t.schedule]
      .some(v => (v ?? '').toLowerCase().includes(q))
  })

  const metaChips = (t: Template) => [t.professor, t.schedule, t.department].filter(Boolean) as string[]

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,10,0.42)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', zIndex: 200 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
        boxShadow: '0 32px 80px rgba(20,16,10,0.28), 0 10px 24px rgba(20,16,10,0.12)',
        zIndex: 210, width: 'min(980px, 95vw)', height: 'min(88svh, 840px)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {view !== 'list' && (
            <button onClick={() => setView('list')} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 17, flexShrink: 0 }} aria-label="戻る">←</button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
              {view === 'publish' ? 'テンプレートを公開' : view === 'edit' ? 'テンプレートを編集' : view === 'detail' ? (selected?.title ?? 'テンプレート') : 'テンプレート'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {view === 'list' ? (profile?.school_id ? '同じ学校で共有された講義を取り込めます' : '学校が未設定です')
                : view === 'edit' ? '保存すると取り込んだ人に「更新あり」が表示されます'
                : view === 'publish' ? '自分の科目を学校のみんなに共有します'
                : selected ? metaChips(selected).join(' ・ ') || `作成: ${selected.creator_name ?? '不明'}` : ''}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-secondary)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 17, flexShrink: 0 }} aria-label="閉じる">×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {view === 'list' && renderList()}
          {view === 'detail' && renderDetail()}
          {view === 'publish' && renderPublish()}
          {view === 'edit' && renderEdit()}
        </div>
      </div>
    </>
  )

  // ============ LIST ============
  function renderList() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Toolbar */}
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, background: 'var(--bg-secondary)', padding: 3, borderRadius: 10 }}>
              {(['all', 'mine'] as const).map(k => (
                <button key={k} onClick={() => setTab(k)} style={{
                  background: tab === k ? 'var(--surface)' : 'transparent',
                  color: tab === k ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
                  {k === 'all' ? 'みんな' : `自分の公開 (${mineCount})`}
                </button>
              ))}
            </div>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="🔍 講義名・教授・時間割・学科で検索" style={{ ...input, flex: 1 }} />
            <button onClick={() => setView('publish')} disabled={subjects.length === 0} style={{ ...primaryBtn(subjects.length === 0), whiteSpace: 'nowrap' }}>＋ 公開</button>
          </div>
        </div>

        {/* Cards */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, padding: '40px 0' }}>読み込み中...</div>
          ) : visible.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1.8, padding: '48px 16px' }}>
              {q ? '該当するテンプレートがありません。' : tab === 'mine' ? <>まだ公開していません。<br />右上の「＋ 公開」から共有できます。</> : <>まだテンプレートがありません。<br />最初の1つを公開してみましょう。</>}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {visible.map(t => {
                const update = hasTemplateUpdate(t)
                return (
                  <button key={t.id} onClick={() => openDetail(t.id)} style={{
                    textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
                    padding: 0, cursor: 'pointer', fontFamily: 'inherit', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(20,16,10,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    <div style={{ height: 6, background: t.color }} />
                    <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.3 }}>{t.title}</div>
                        {update && <span style={{ background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 6px', flexShrink: 0 }}>更新あり</span>}
                        {!update && t.imported && <span style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 6px', flexShrink: 0 }}>取り込み済</span>}
                      </div>
                      {metaChips(t).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {metaChips(t).map((c, i) => (
                            <span key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 5, padding: '2px 7px' }}>{c}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>📄 {t.item_count}件</span>
                        <span>👤 {t.import_count}人</span>
                        {t.creator_name && <span style={{ marginLeft: 'auto' }}>{t.creator_name}</span>}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ============ DETAIL ============
  function renderDetail() {
    if (!selected) return null
    const t = selected
    const mine = isMine(t)
    const update = hasTemplateUpdate(t)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* meta summary */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <Stat label="課題数" value={`${t.item_count ?? detailItems.length}件`} />
            <Stat label="取り込み" value={`${t.import_count}人`} />
            <Stat label="バージョン" value={`v${t.version}`} />
            {t.creator_name && <Stat label="作成者" value={t.creator_name} />}
          </div>
          {t.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>{t.description}</p>}

          {update && (
            <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', marginBottom: 4 }}>このテンプレートに更新があります</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                適用すると変更・追加が反映されます。<b>あなたの進捗（ステータス）やメモはそのまま保持</b>されます。
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleApplyUpdate(t.id)} disabled={busy} style={primaryBtn(busy)}>更新を適用</button>
                <button onClick={() => handleDismiss(t.id)} disabled={busy} style={ghostBtn}>今は適用しない</button>
              </div>
            </div>
          )}

          {/* items */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: 8 }}>含まれる課題</div>
          {itemsLoading ? (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>読み込み中...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {detailItems.map(it => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 9 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{it.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {formatDate(it.start_date)} → {formatDate(it.due_date)}{it.due_time ? ` ${it.due_time}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer actions */}
        <div style={{ borderTop: '1px solid var(--border-light)', padding: '14px 20px', display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
          {mine ? (
            <>
              <button onClick={() => openEdit(t)} style={{ ...ghostBtn }}>編集して更新を公開</button>
              <button onClick={() => handleDelete(t.id)} disabled={busy} style={{ ...ghostBtn, color: 'var(--danger)' }}>削除</button>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>自分が公開したテンプレート</div>
            </>
          ) : t.imported ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{update ? '取り込み済み（更新あり）' : '取り込み済み・最新'}</div>
              <button onClick={() => handleImport(t.id)} disabled={busy} style={{ ...ghostBtn, marginLeft: 'auto' }}>もう一度取り込む</button>
            </>
          ) : (
            <button onClick={() => handleImport(t.id)} disabled={busy} style={{ ...primaryBtn(busy), marginLeft: 'auto', minWidth: 160 }}>{busy ? '取り込み中...' : 'このテンプレートを取り込む'}</button>
          )}
        </div>
      </div>
    )
  }

  // ============ PUBLISH ============
  function renderPublish() {
    return (
      <div style={{ padding: 20, maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={label}>公開する科目</label>
          <select value={pSubjectId} onChange={e => setPSubjectId(e.target.value)} style={input}>
            <option value="">科目を選択...</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label style={label}>教授名（任意）</label><input value={pProfessor} onChange={e => setPProfessor(e.target.value)} style={input} placeholder="山田 太郎" maxLength={40} /></div>
          <div style={{ flex: 1 }}><label style={label}>時間割（任意）</label><input value={pSchedule} onChange={e => setPSchedule(e.target.value)} style={input} placeholder="月3限" maxLength={30} /></div>
        </div>
        <div><label style={label}>学科名（任意）</label><input value={pDepartment} onChange={e => setPDepartment(e.target.value)} style={input} placeholder="情報工学科" maxLength={40} /></div>
        <div><label style={label}>説明（任意）</label><input value={pDesc} onChange={e => setPDesc(e.target.value)} style={input} placeholder="2026年前期" maxLength={100} /></div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.6 }}>
          選んだ科目の課題が講義名・日程ごとテンプレートになります。作成者名（{profile?.display_name}）が表示されます。
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={handlePublish} disabled={!pSubjectId || busy} style={{ ...primaryBtn(!pSubjectId || busy), flex: 1 }}>{busy ? '公開中...' : '公開する'}</button>
          <button onClick={() => setView('list')} style={ghostBtn}>やめる</button>
        </div>
      </div>
    )
  }

  // ============ EDIT ============
  function renderEdit() {
    const setItem = (idx: number, patch: Partial<TemplateItemDraft>) =>
      setEItems(items => items.map((it, i) => i === idx ? { ...it, ...patch } : it))
    const addItem = () => {
      const today = new Date().toISOString().slice(0, 10)
      setEItems(items => [...items, { title: '', start_date: today, due_date: today, due_time: null }])
    }
    const removeItem = (idx: number) => setEItems(items => items.filter((_, i) => i !== idx))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={label}>講義名</label><input value={eTitle} onChange={e => setETitle(e.target.value)} style={input} maxLength={60} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label style={label}>教授名</label><input value={eProfessor} onChange={e => setEProfessor(e.target.value)} style={input} maxLength={40} /></div>
            <div style={{ flex: 1 }}><label style={label}>時間割</label><input value={eSchedule} onChange={e => setESchedule(e.target.value)} style={input} maxLength={30} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label style={label}>学科名</label><input value={eDepartment} onChange={e => setEDepartment(e.target.value)} style={input} maxLength={40} /></div>
            <div style={{ flex: 1 }}><label style={label}>説明</label><input value={eDesc} onChange={e => setEDesc(e.target.value)} style={input} maxLength={100} /></div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ ...label, marginBottom: 0 }}>課題（{eItems.length}件）</div>
              <button onClick={addItem} style={{ ...ghostBtn, padding: '6px 12px', fontSize: 13 }}>＋ 課題を追加</button>
            </div>
            {itemsLoading ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>読み込み中...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {eItems.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-secondary)', padding: 10, borderRadius: 9 }}>
                    <input value={it.title} onChange={e => setItem(idx, { title: e.target.value })} placeholder="課題名" style={{ ...input, flex: 1 }} />
                    <input type="date" value={it.start_date} onChange={e => setItem(idx, { start_date: e.target.value })} style={{ ...input, width: 140 }} />
                    <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                    <input type="date" value={it.due_date} onChange={e => setItem(idx, { due_date: e.target.value })} style={{ ...input, width: 140 }} />
                    <button onClick={() => removeItem(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }} aria-label="削除">🗑</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-light)', padding: '14px 20px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', flex: 1, lineHeight: 1.5 }}>
            公開すると、取り込んだ人に「更新あり」が表示されます（適用は各自の任意）。
          </div>
          <button onClick={() => setView('detail')} style={ghostBtn}>やめる</button>
          <button onClick={handleSaveEdit} disabled={busy} style={primaryBtn(busy)}>{busy ? '公開中...' : '更新を公開'}</button>
        </div>
      </div>
    )
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '9px 14px', minWidth: 72 }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginTop: 1 }}>{value}</div>
    </div>
  )
}
