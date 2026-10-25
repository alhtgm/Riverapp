import type { ReactNode } from 'react'
import type { AppNotification } from '../../types'
import NoticeFrame, { NoticeTitle } from './NoticeFrame'

const svg = (children: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
)

const megaphoneIcon = svg(<>
  <path d="M4 10v4a1 1 0 001 1h2l8 4V5L7 9H5a1 1 0 00-1 1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  <path d="M18.5 9a4 4 0 010 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
</>)

const replyIcon = svg(
  <path d="M5 5h14a1 1 0 011 1v9a1 1 0 01-1 1h-8l-4 3.5V16H5a1 1 0 01-1-1V6a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
)

const CATEGORY_LABEL: Record<string, string> = { bug: 'バグ報告', request: '要望', other: 'その他' }

/** 運営からのお知らせ・開発者からの返事のカード（返事なら自分が送ったメッセージの引用つき） */
export default function MessageNotice({ notification: n, time, isNew }: {
  notification: AppNotification
  time: string
  isNew: boolean
}) {
  const p = n.payload
  const isAnnouncement = n.type === 'announcement'
  const original = String(p.original ?? '')

  return (
    <NoticeFrame
      tone={isAnnouncement
        ? { fg: 'var(--accent-dark)', bg: 'var(--accent-bg)' }
        : { fg: 'var(--st-progress)', bg: 'var(--st-progress-bg)' }}
      icon={isAnnouncement ? megaphoneIcon : replyIcon}
      label={isAnnouncement ? '運営からのお知らせ' : '開発者からの返事'}
      createdAt={n.created_at}
      time={time}
      isNew={isNew}
    >
      {isAnnouncement ? (
        <NoticeTitle>{String(p.title ?? '')}</NoticeTitle>
      ) : (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <span style={{ fontSize: 'var(--type-label-medium-size)', color: 'var(--text-secondary)' }}>
            あなたが送ったメッセージ{typeof p.category === 'string' && CATEGORY_LABEL[p.category] ? `（${CATEGORY_LABEL[p.category]}）` : ''}
          </span>
          <span style={{
            padding: 'var(--space-1) var(--space-3)', borderLeft: '3px solid var(--border-strong)',
            color: 'var(--text-secondary)', fontSize: 'var(--type-body-medium-size)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
          }}>
            {original}{original.length >= 80 ? '…' : ''}
          </span>
        </span>
      )}
      <span style={{
        whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--text-primary)',
        fontSize: 'var(--type-body-large-size)', lineHeight: 1.75,
      }}>
        {typeof p.body === 'string' ? p.body : ''}
      </span>
    </NoticeFrame>
  )
}
