import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toMessage } from '../../lib/errors'
import {
  LIMITS, INVITE_CODE_TTLS, INVITE_CODE_MAX_USES, DEFAULT_INVITE_CODE_TTL, DEFAULT_INVITE_CODE_MAX_USES,
} from '../../lib/limits'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet from '../ui/Sheet'
import { btn, sectionTitle, inputStyle, emptyText, listRow } from '../ui/styles'
import LectureList from '../lecture/LectureList'
import MemberList from './MemberList'
import type { LectureSummary, PartyInviteCode, PartyMember } from '../../types'

interface Props {
  partyId: string
  onClose: () => void
  onOpenLecture: (lectureId: string) => void
  onOpenProfile: (userId: string) => void
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function PartyHome({ partyId, onClose, onOpenLecture, onOpenProfile }: Props) {
  const { showToast } = useToast()
  const { parties, friends, users, fetchSocial } = useSocialStore()
  const party = parties.find(p => p.id === partyId)

  const [lectures, setLectures] = useState<LectureSummary[] | null>(null)
  const [members, setMembers] = useState<PartyMember[]>([])
  const [codes, setCodes] = useState<PartyInviteCode[]>([])
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(party?.name ?? '')
  const [ttl, setTtl] = useState<string>(DEFAULT_INVITE_CODE_TTL)
  const [maxUses, setMaxUses] = useState<number>(DEFAULT_INVITE_CODE_MAX_USES)
  const [inviteFriend, setInviteFriend] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [lecRes, memRes, codeRes] = await Promise.all([
      supabase.rpc('get_party_lectures', { p_party_id: partyId }),
      supabase.from('party_members').select('party_id, user_id, status, joined_at').eq('party_id', partyId).in('status', ['active', 'excluded']),
      supabase.from('party_invite_codes').select('*').eq('party_id', partyId).is('revoked_at', null)
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    ])
    setLectures((lecRes.data ?? []) as LectureSummary[])
    setMembers((memRes.data ?? []) as PartyMember[])
    setCodes(((codeRes.data ?? []) as PartyInviteCode[]).filter(c => c.use_count < c.max_uses))
  }, [partyId])

  useEffect(() => { void load() }, [load])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  if (!party) {
    return (
      <Sheet title="パーティー" onClose={onClose} zIndex={310}>
        <p style={emptyText}>このパーティーは表示できません</p>
      </Sheet>
    )
  }

  const activeCount = members.filter(m => m.status === 'active').length
  const memberIds = new Set(members.filter(m => m.status === 'active').map(m => m.user_id))
  const invitableFriends = friends.filter(f => !memberIds.has(f.userId))

  return (
    <Sheet
      title={
        editingName ? (
          <form
            style={{ display: 'flex', gap: 6 }}
            onSubmit={e => {
              e.preventDefault()
              void run(async () => {
                const n = name.trim()
                if (!n) throw new Error('パーティー名を入力してください')
                const { error } = await supabase.from('parties').update({ name: n }).eq('id', partyId)
                if (error) throw error
                setEditingName(false)
                await fetchSocial()
                showToast('パーティー名を変更しました')
              })
            }}
          >
            <input value={name} onChange={e => setName(e.target.value)} maxLength={40} autoFocus style={{ ...inputStyle, padding: '5px 9px' }} />
            <button type="submit" style={btn('primary', true)} disabled={busy}>保存</button>
            <button type="button" style={btn('ghost', true)} onClick={() => { setEditingName(false); setName(party.name) }}>やめる</button>
          </form>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {party.name}
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>{activeCount}/{LIMITS.partyMaxMembers}人</span>
            <button style={btn('ghost', true)} onClick={() => { setName(party.name); setEditingName(true) }}>名前を変更</button>
          </span>
        )
      }
      onClose={onClose}
      zIndex={310}
      width={600}
    >
      <div>
        <p style={sectionTitle}>メンバーが参加している講義</p>
        {lectures === null ? (
          <p style={emptyText}>読み込み中...</p>
        ) : (
          <LectureList
            lectures={lectures}
            onChanged={load}
            onOpenLecture={onOpenLecture}
            emptyMessage="あなたから見える講義はまだありません"
          />
        )}
      </div>

      <MemberList
        targetType="party"
        targetId={partyId}
        members={members.map(m => ({ userId: m.user_id, status: m.status }))}
        onOpenProfile={onOpenProfile}
        onChanged={() => { void load(); void fetchSocial() }}
      />

      <div>
        <p style={sectionTitle}>フレンドを招待</p>
        {invitableFriends.length === 0 ? (
          <p style={emptyText}>招待できるフレンドがいません</p>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={inviteFriend} onChange={e => setInviteFriend(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="">フレンドを選択</option>
              {invitableFriends.map(f => <option key={f.userId} value={f.userId}>{userLabel(users, f.userId)}</option>)}
            </select>
            <button
              style={btn('primary')}
              disabled={!inviteFriend || busy}
              onClick={() => run(async () => {
                const { error } = await supabase.rpc('invite_to_party', { p_party_id: partyId, p_invitee_id: inviteFriend })
                if (error) throw error
                setInviteFriend('')
                showToast('招待を送りました')
              })}
            >
              招待
            </button>
          </div>
        )}
      </div>

      <div>
        <p style={sectionTitle}>招待コード</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>有効期限</label>
          <select value={ttl} onChange={e => setTtl(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '6px 9px' }}>
            {INVITE_CODE_TTLS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>使用回数</label>
          <select value={maxUses} onChange={e => setMaxUses(Number(e.target.value))} style={{ ...inputStyle, width: 'auto', padding: '6px 9px' }}>
            {INVITE_CODE_MAX_USES.map(n => <option key={n} value={n}>{n}回</option>)}
          </select>
          <button
            style={btn('primary', true)}
            disabled={busy}
            onClick={() => run(async () => {
              const { error } = await supabase.rpc('create_party_invite_code', { p_party_id: partyId, p_ttl: ttl, p_max_uses: maxUses })
              if (error) throw error
              await load()
              showToast('招待コードを発行しました')
            })}
          >
            発行
          </button>
        </div>
        {codes.length === 0 ? (
          <p style={emptyText}>有効な招待コードはありません</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {codes.map(c => (
              <div key={c.id} style={listRow}>
                <code style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-primary)' }}>{c.code}</code>
                <span style={{ flex: 1, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {formatDateTime(c.expires_at)}まで・{c.use_count}/{c.max_uses}回
                </span>
                <button
                  style={btn('secondary', true)}
                  onClick={() => {
                    void navigator.clipboard?.writeText(c.code).then(
                      () => showToast('コピーしました'),
                      () => showToast('コピーできませんでした', 'error'),
                    )
                  }}
                >
                  コピー
                </button>
                <button
                  style={btn('danger', true)}
                  disabled={busy}
                  onClick={() => run(async () => {
                    const { error } = await supabase.rpc('revoke_party_invite_code', { p_code_id: c.id })
                    if (error) throw error
                    await load()
                    showToast('招待コードを無効にしました')
                  })}
                >
                  無効化
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
        {!confirmLeave ? (
          <button style={btn('danger')} onClick={() => setConfirmLeave(true)}>パーティーを退出</button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              退出しますか？{activeCount <= 1 && '最後の1人なので、パーティーはアーカイブされます。'}
            </span>
            <button
              style={btn('danger')}
              disabled={busy}
              onClick={() => run(async () => {
                const { error } = await supabase.rpc('leave_party', { p_party_id: partyId })
                if (error) throw error
                await fetchSocial()
                showToast('パーティーを退出しました')
                onClose()
              })}
            >
              退出する
            </button>
            <button style={btn('ghost')} onClick={() => setConfirmLeave(false)}>やめる</button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
