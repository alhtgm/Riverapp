import type { ReactNode } from 'react'
import { VISIBILITY_LABEL, type AppNotification, type LectureVisibility, type Subject, type UserSummary } from '../../types'
import { describeNotification } from '../../lib/notificationText'
import { Avatar } from '../ui/kit'
import NoticeFrame, { NoticeChange, NoticeLecture, NoticeText, NoticeTitle, type NoticeTone } from './NoticeFrame'

const svg = (children: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
)

const icons = {
  personAdd: svg(<>
    <circle cx="10" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 19.5c.7-3.4 3.3-5.3 6.5-5.3 1.5 0 2.9.4 4 1.2M18 13v6M15 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </>),
  personCheck: svg(<>
    <circle cx="10" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 19.5c.7-3.4 3.3-5.3 6.5-5.3 1.5 0 2.9.4 4 1.2M15 16.5l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  group: svg(<>
    <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    <path d="M17 14c2 .2 3.5 1.7 4 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </>),
  inbox: svg(<>
    <path d="M4 13l2.5-7.5h11L20 13v5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18v-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M4 13h4.5l1 2h5l1-2H20" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </>),
  approved: svg(<>
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 12.3l2.7 2.7L16 9.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </>),
  rejected: svg(<>
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </>),
  eye: svg(<>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
  </>),
  id: svg(<>
    <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="9" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M5.8 16c.5-1.5 1.7-2.3 3.2-2.3s2.7.8 3.2 2.3M14.5 10h4M14.5 13.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </>),
  bell: svg(<>
    <path d="M6 16.5V11a6 6 0 1112 0v5.5l1.6 2H4.4L6 16.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M10 21a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </>),
}

const TONES: Record<'accent' | 'done' | 'progress' | 'danger' | 'submitted' | 'neutral', NoticeTone> = {
  accent: { fg: 'var(--accent-dark)', bg: 'var(--accent-bg)' },
  done: { fg: 'var(--st-done)', bg: 'var(--st-done-bg)' },
  progress: { fg: 'var(--st-progress)', bg: 'var(--st-progress-bg)' },
  danger: { fg: 'var(--danger)', bg: 'var(--danger-bg)' },
  submitted: { fg: 'var(--st-submitted)', bg: 'var(--st-submitted-bg)' },
  neutral: { fg: 'var(--text-secondary)', bg: 'var(--bg-secondary)' },
}

/** カードの中の人（アバター・表示名・ユーザーID） */
function Person({ user, fallback = 'ユーザー' }: { user: UserSummary | undefined; fallback?: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <Avatar name={user?.display_name ?? fallback} size={36} />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <NoticeTitle>{user?.display_name ?? fallback}</NoticeTitle>
        {user?.handle && <span style={{ fontSize: 'var(--type-body-small-size)', color: 'var(--text-secondary)' }}>@{user.handle}</span>}
      </span>
    </span>
  )
}

/**
 * 課題・運営以外のお知らせのカード（フレンド・パーティー・参加申請・公開範囲・ユーザーIDなど）。
 * 知らない種類は文面だけのカードにする
 */
export default function GeneralNotice({ notification: n, users, subjects, time, isNew, openLabel, onOpen }: {
  notification: AppNotification
  users: Record<string, UserSummary>
  subjects: Pick<Subject, 'id' | 'name' | 'color'>[]
  time: string
  isNew: boolean
  openLabel?: string
  onOpen?: () => void
}) {
  const p = n.payload
  const user = (id: unknown) => (typeof id === 'string' ? users[id] : undefined)
  const userName = (id: unknown) => user(id)?.display_name ?? 'ユーザー'
  const subject = subjects.find(s => s.id === p.lecture_id)
  const lectureName = String(p.title ?? subject?.name ?? '講義')
  const frame = { createdAt: n.created_at, time, isNew, openLabel, onOpen }

  switch (n.type) {
    case 'friend_request':
      return (
        <NoticeFrame {...frame} tone={TONES.accent} icon={icons.personAdd} label="フレンド申請">
          <Person user={user(p.requester_id)} />
          <NoticeText>あなたにフレンド申請を送りました</NoticeText>
        </NoticeFrame>
      )
    case 'friend_accepted':
      return (
        <NoticeFrame {...frame} tone={TONES.done} icon={icons.personCheck} label="フレンドになりました">
          <Person user={user(p.addressee_id)} />
          <NoticeText>フレンド申請を承認しました。パーティーに招待できます</NoticeText>
        </NoticeFrame>
      )
    case 'party_invite':
      return (
        <NoticeFrame {...frame} tone={TONES.submitted} icon={icons.group} label="パーティーへの招待"
          footnote={`${userName(p.inviter_id)}さんからの招待`}>
          <NoticeTitle>{String(p.party_name ?? 'パーティー')}</NoticeTitle>
          <NoticeText>このパーティーに招待されました</NoticeText>
        </NoticeFrame>
      )
    case 'lecture_apply_request':
      return (
        <NoticeFrame {...frame} tone={TONES.progress} icon={icons.inbox} label="講義への参加申請">
          <NoticeLecture name={lectureName} color={subject?.color} />
          <Person user={user(p.applicant_id)} />
          <NoticeText>この講義への参加申請が届きました</NoticeText>
        </NoticeFrame>
      )
    case 'lecture_apply_response': {
      const approved = p.approved === true
      return (
        <NoticeFrame {...frame} tone={approved ? TONES.done : TONES.danger} icon={approved ? icons.approved : icons.rejected}
          label={approved ? '参加申請が承認されました' : '参加申請が却下されました'}>
          <NoticeLecture name={lectureName} color={subject?.color} />
          <NoticeText>{approved ? 'この講義に参加しました。課題がタイムラインに表示されます' : 'この講義には参加できませんでした'}</NoticeText>
        </NoticeFrame>
      )
    }
    case 'lecture_visibility_changed':
      return (
        <NoticeFrame {...frame} tone={TONES.neutral} icon={icons.eye} label="公開範囲の変更">
          <NoticeLecture name={lectureName} color={subject?.color} />
          <NoticeChange
            from={VISIBILITY_LABEL[p.old_visibility as LectureVisibility] ?? ''}
            to={VISIBILITY_LABEL[p.new_visibility as LectureVisibility] ?? ''}
            color="var(--text-primary)"
          />
        </NoticeFrame>
      )
    case 'handle_reassigned':
      return (
        <NoticeFrame {...frame} tone={TONES.accent} icon={icons.id} label="ユーザーIDの変更">
          <NoticeChange from={`@${String(p.old_handle ?? '')}`} to={`@${String(p.new_handle ?? '')}`} color="var(--accent-dark)" />
          <NoticeText muted>ユーザーIDは自動で決まる形になりました。フレンドやパーティーはそのままです。新しいIDは「プロフィールとアカウント」でコピーできます</NoticeText>
        </NoticeFrame>
      )
    default:
      return (
        <NoticeFrame {...frame} tone={TONES.neutral} icon={icons.bell} label="お知らせ">
          <NoticeText>{describeNotification(n, users, subjects)}</NoticeText>
        </NoticeFrame>
      )
  }
}
