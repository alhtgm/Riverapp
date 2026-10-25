import type { CSSProperties, ReactNode } from 'react'

export interface NoticeTone {
  /** 帯の文字とアイコンの色 */
  fg: string
  /** 帯の背景 */
  bg: string
}

/**
 * 受信箱のお知らせカードの共通の枠。どの種類も同じ並びにして見比べやすくする。
 *   上の帯: 種類のアイコンと名前・新着・届いた時刻
 *   真ん中: 種類ごとの中身（children）
 *   下の行: 誰が操作したかなどの補足と「◯◯を開く ›」（どちらもなければ出さない）
 * onOpen があればカード全体を押せるボタンにする
 */
export default function NoticeFrame({ tone, icon, label, createdAt, time, isNew, footnote, openLabel, onOpen, children }: {
  tone: NoticeTone
  icon: ReactNode
  label: string
  createdAt: string
  /** 「3分前」など */
  time: string
  /** 受信箱を開いた時点で未読だった */
  isNew: boolean
  /** 下の行の左（「◯◯さんが追加しました」など） */
  footnote?: string
  /** 下の行の右（「講義を開く」など）。onOpen があるときだけ出す */
  openLabel?: string
  onOpen?: () => void
  children: ReactNode
}) {
  const showFooter = !!footnote || (!!onOpen && !!openLabel)

  const content = (
    <>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)',
        background: tone.bg, color: tone.fg, fontSize: 'var(--type-label-large-size)', fontWeight: 600,
      }}>
        {icon}
        <span>{label}</span>
        {isNew && (
          <span style={{
            fontSize: 'var(--type-label-small-size)', padding: '0 var(--space-2)', borderRadius: 'var(--shape-full)',
            background: 'var(--danger)', color: 'var(--surface)', lineHeight: '18px',
          }}>新着</span>
        )}
        <span style={{ flex: 1 }} />
        <time dateTime={createdAt} style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 'var(--type-body-small-size)' }}>{time}</time>
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)' }}>
        {children}
      </span>

      {showFooter && (
        <span style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)',
          borderTop: '1px solid var(--border-light, var(--border))', fontSize: 'var(--type-body-small-size)', color: 'var(--text-secondary)',
        }}>
          <span style={{ flex: 1 }}>{footnote}</span>
          {onOpen && openLabel && <span style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>{openLabel} ›</span>}
        </span>
      )}
    </>
  )

  const frame: CSSProperties = {
    display: 'flex', flexDirection: 'column', width: '100%', padding: 0, textAlign: 'left',
    border: `1px solid ${isNew ? 'var(--accent-dark)' : 'var(--border)'}`, borderRadius: 'var(--shape-md)',
    background: 'var(--surface)', overflow: 'hidden', color: 'inherit', font: 'inherit',
  }

  return onOpen
    ? <button type="button" className="m3-state" onClick={onOpen} style={{ ...frame, cursor: 'pointer' }}>{content}</button>
    : <article aria-label={label} style={frame}>{content}</article>
}

/** カードの中の大きめの見出し（課題名・お知らせの見出し・パーティー名など） */
export function NoticeTitle({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 'var(--type-title-medium-size)', lineHeight: 'var(--type-title-medium-line)', fontWeight: 700, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
      {children}
    </span>
  )
}

/** カードの中の講義名（講義の色の点つき） */
export function NoticeLecture({ name, color }: { name: string; color?: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: 'var(--type-label-large-size)' }}>
      <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 'var(--shape-full)', background: color ?? 'var(--border-strong)', flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </span>
  )
}

/** 変更前 → 変更後（変更前は取り消し線、変更後は強調） */
export function NoticeChange({ from, to, color, extra }: { from: ReactNode; to: ReactNode; color: string; extra?: ReactNode }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--text-secondary)', textDecoration: 'line-through' }}>{from}</span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--text-secondary)' }}>
        <path d="M3 8h9.5M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontWeight: 700, color }}>{to}</span>
      {extra}
    </span>
  )
}

/** 本文（ふつうの文） */
export function NoticeText({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span style={{ color: muted ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: 'var(--type-body-medium-size)', lineHeight: 1.6, overflowWrap: 'anywhere' }}>
      {children}
    </span>
  )
}
