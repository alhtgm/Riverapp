import type { ReactNode } from 'react'
import type { AppNotification } from '../../types'

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

/**
 * 運営からのお知らせ・開発者からの返事のカード。
 * 上に種類と届いた時刻、真ん中に見出し、下に本文（返事なら自分が送ったメッセージの引用つき）を置く
 */
export default function MessageNotice({ notification: n, time, isNew }: {
  notification: AppNotification
  /** 「3分前」など */
  time: string
  /** 受信箱を開いた時点で未読だった */
  isNew: boolean
}) {
  const p = n.payload
  const isAnnouncement = n.type === 'announcement'
  const body = typeof p.body === 'string' ? p.body : ''

  return (
    <article
      aria-label={isAnnouncement ? `運営からのお知らせ: ${String(p.title ?? '')}` : '開発者からの返事'}
      style={{
        border: `1px solid ${isNew ? 'var(--accent-dark)' : 'var(--border)'}`,
        borderRadius: 'var(--shape-md)', background: 'var(--surface)', overflow: 'hidden',
      }}
    >
      <header style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)',
        background: isAnnouncement ? 'var(--accent-bg)' : 'var(--st-progress-bg)',
        color: isAnnouncement ? 'var(--accent-dark)' : 'var(--st-progress)',
        fontSize: 'var(--type-label-large-size)', fontWeight: 600,
      }}>
        {isAnnouncement ? megaphoneIcon : replyIcon}
        <span>{isAnnouncement ? '運営からのお知らせ' : '開発者からの返事'}</span>
        {isNew && (
          <span style={{
            fontSize: 'var(--type-label-small-size)', padding: '0 var(--space-2)', borderRadius: 'var(--shape-full)',
            background: 'var(--danger)', color: 'var(--surface)', lineHeight: '18px',
          }}>新着</span>
        )}
        <span style={{ flex: 1 }} />
        <time dateTime={n.created_at} style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 'var(--type-body-small-size)' }}>{time}</time>
      </header>

      <div style={{ padding: 'var(--space-3) var(--space-4) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {isAnnouncement ? (
          <h3 style={{ margin: 0, fontSize: 'var(--type-title-medium-size)', lineHeight: 'var(--type-title-medium-line)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {String(p.title ?? '')}
          </h3>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--type-label-medium-size)', color: 'var(--text-secondary)' }}>
              あなたが送ったメッセージ{typeof p.category === 'string' && CATEGORY_LABEL[p.category] ? `（${CATEGORY_LABEL[p.category]}）` : ''}
            </span>
            <blockquote style={{
              margin: 0, padding: 'var(--space-1) var(--space-3)', borderLeft: '3px solid var(--border-strong)',
              color: 'var(--text-secondary)', fontSize: 'var(--type-body-medium-size)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
            }}>
              {String(p.original ?? '')}{String(p.original ?? '').length >= 80 ? '…' : ''}
            </blockquote>
          </div>
        )}
        <p style={{
          margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--text-primary)',
          fontSize: 'var(--type-body-large-size)', lineHeight: 1.75,
        }}>
          {body}
        </p>
      </div>
    </article>
  )
}
