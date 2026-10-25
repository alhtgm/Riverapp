import { useEffect, useState, type ReactNode } from 'react'
import { toMessage } from '../../lib/errors'
import { isMessageNotice, isTaskNotice } from '../../lib/notificationText'
import MessageNotice from './MessageNotice'
import TaskNotice from './TaskNotice'
import GeneralNotice from './GeneralNotice'
import { useStore } from '../../store/useStore'
import { useSocialStore, userLabel } from '../../store/useSocialStore'
import { useToast } from '../ui/Toast'
import Sheet from '../ui/Sheet'
import { Avatar, Button, EmptyState, List, ListItem, Section } from '../ui/kit'
import type { AppNotification } from '../../types'

interface Props {
  onClose: () => void
  onOpenProfile: (userId: string) => void
  onOpenParty: (partyId: string) => void
  onOpenLecture: (lectureId: string) => void
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'たった今'
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`
  return `${Math.floor(diff / 86400)}日前`
}

/** 返事が必要な1件（種類は違っても同じ形で並べる） */
interface PendingItem {
  key: string
  avatar: string | null
  text: ReactNode
  sub?: string
  onOpen?: () => void
  rejectLabel: string
  acceptLabel: string
  reject: () => Promise<void>
  accept: () => Promise<void>
}

/**
 * 受信箱。上に「返事が必要」（フレンド申請・パーティーの招待・講義への参加申請）、
 * 下に「お知らせ」の履歴。返事はどれもこの画面で1回押すだけで終わる。
 */
export default function InboxPanel({ onClose, onOpenProfile, onOpenParty, onOpenLecture }: Props) {
  const { showToast } = useToast()
  const social = useSocialStore()
  const { users, incoming, invites, applyRequests, notifications } = social
  const { subjects, fetchAll } = useStore()
  const [busy, setBusy] = useState(false)

  // 開くとすぐ既読になるので、開いた時点で未読だったお知らせを覚えておき「新着」と出す
  const [unreadAtOpen] = useState(() => new Set(notifications.filter(n => !n.read_at).map(n => n.id)))

  useEffect(() => { void social.fetchSocial() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // 開いたらお知らせを既読にする
  useEffect(() => {
    if (social.loaded) void social.markAllNotificationsRead()
  }, [social.loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } catch (e: unknown) { showToast(toMessage(e), 'error') } finally { setBusy(false) }
  }

  const pending: PendingItem[] = [
    ...incoming.map((r): PendingItem => ({
      key: `f:${r.id}`,
      avatar: userLabel(users, r.requester_id),
      text: <><b>{userLabel(users, r.requester_id)}</b>さんからフレンド申請</>,
      sub: users[r.requester_id]?.handle ? `@${users[r.requester_id]?.handle}` : undefined,
      onOpen: () => onOpenProfile(r.requester_id),
      rejectLabel: '拒否', acceptLabel: '承認',
      reject: async () => { await social.removeFriendRequest(r.id); showToast('申請を拒否しました') },
      accept: async () => { await social.acceptFriendRequest(r.id); showToast(`${userLabel(users, r.requester_id)}さんとフレンドになりました`) },
    })),
    ...invites.map((inv): PendingItem => ({
      key: `p:${inv.id}`,
      avatar: inv.party_name,
      text: <><b>{userLabel(users, inv.inviter_id)}</b>さんから「{inv.party_name}」への招待</>,
      sub: `メンバー${inv.member_count}人`,
      rejectLabel: '断る', acceptLabel: '参加する',
      reject: async () => { await social.respondPartyInvite(inv.id, false); showToast('招待を断りました') },
      accept: async () => {
        await social.respondPartyInvite(inv.id, true)
        await fetchAll({ silent: true })
        showToast(`「${inv.party_name}」に参加しました`)
      },
    })),
    ...applyRequests.map((r): PendingItem => ({
      key: `a:${r.id}`,
      avatar: r.display_name,
      text: <><b>{r.display_name ?? 'ユーザー'}</b>さんが「{r.lecture_title}」に参加したい</>,
      sub: r.handle ? `@${r.handle}` : undefined,
      onOpen: () => onOpenProfile(r.user_id),
      rejectLabel: '却下', acceptLabel: '承認',
      reject: async () => {
        const failed = await social.respondApplyRequests([r.id], false)
        showToast(failed ? 'ほかの人が対応済みか、期限切れでした' : '参加申請を却下しました', failed ? 'error' : undefined)
      },
      accept: async () => {
        const failed = await social.respondApplyRequests([r.id], true)
        showToast(failed ? 'ほかの人が対応済みか、期限切れでした' : `${r.display_name ?? 'ユーザー'}さんの参加を承認しました`, failed ? 'error' : undefined)
      },
    })),
  ]

  const acceptAll = () => run(async () => {
    let failed = 0
    for (const item of pending) {
      try { await item.accept() } catch { failed++ }
    }
    showToast(`${pending.length - failed}件を承認しました${failed ? `（${failed}件はできませんでした）` : ''}`, failed ? 'error' : undefined)
  })

  /** お知らせを押したときに開く画面と、カードの右下に出すその名前 */
  const openTarget = (n: AppNotification): { label: string; open: () => void } | undefined => {
    const p = n.payload
    if (typeof p.lecture_id === 'string' && subjects.some(s => s.id === p.lecture_id)) {
      return { label: '講義を開く', open: () => onOpenLecture(p.lecture_id as string) }
    }
    if (n.type === 'party_invite' && typeof p.party_id === 'string' && social.parties.some(pt => pt.id === p.party_id)) {
      return { label: 'パーティーを開く', open: () => onOpenParty(p.party_id as string) }
    }
    const uid = [p.requester_id, p.addressee_id, p.applicant_id, p.inviter_id].find((v): v is string => typeof v === 'string')
    return uid ? { label: 'プロフィールを開く', open: () => onOpenProfile(uid) } : undefined
  }

  return (
    <Sheet placement="side" title="受信箱" subtitle="返事が必要な申請・招待と、お知らせが届きます" onClose={onClose} width={640} height={720}>
      <Section
        title="返事が必要"
        count={pending.length}
        description="承認・参加はここで1回押すだけで終わります"
        action={pending.length > 1 && (
          <Button size="sm" variant="primary" loading={busy} onClick={() => void acceptAll()}>すべて承認（{pending.length}）</Button>
        )}
      >
        {pending.length === 0 ? (
          <EmptyState compact title="返事が必要なものはありません" description="フレンド申請・パーティーの招待・講義への参加申請が届くと、ここに並びます。" />
        ) : (
          <List>
            {pending.map(item => (
              <ListItem
                key={item.key}
                highlight
                leading={<Avatar name={item.avatar} size={34} />}
                title={<span style={{ whiteSpace: 'normal' }}>{item.text}</span>}
                subtitle={item.sub}
                onClick={item.onOpen}
                trailing={
                  <>
                    <Button size="sm" disabled={busy} onClick={() => void run(item.reject)}>{item.rejectLabel}</Button>
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => void run(item.accept)}>{item.acceptLabel}</Button>
                  </>
                }
              />
            ))}
          </List>
        )}
      </Section>

      <Section title="お知らせ" description="押すと関係する画面を開きます">
        {notifications.length === 0 ? (
          <EmptyState compact title="お知らせはまだありません" description="締切の変更や、申請が承認されたことなどが届きます。" />
        ) : (
          <List>
            {/* どの種類も同じ並びのカード（上に種類と時刻、真ん中に中身、下に補足と「◯◯を開く」） */}
            {notifications.map(n => {
              const time = timeAgo(n.created_at)
              const isNew = unreadAtOpen.has(n.id)
              const target = openTarget(n)
              if (isMessageNotice(n)) return <MessageNotice key={n.id} notification={n} time={time} isNew={isNew} />
              if (isTaskNotice(n)) {
                return <TaskNotice key={n.id} notification={n} users={users} subjects={subjects} time={time} isNew={isNew} onOpen={target?.open} />
              }
              return (
                <GeneralNotice
                  key={n.id}
                  notification={n}
                  users={users}
                  subjects={subjects}
                  time={time}
                  isNew={isNew}
                  openLabel={target?.label}
                  onOpen={target?.open}
                />
              )
            })}
          </List>
        )}
      </Section>
    </Sheet>
  )
}
