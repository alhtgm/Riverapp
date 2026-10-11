import type { CSSProperties } from 'react'

// 新しい画面（フレンド・パーティー・講義）で共通に使うスタイル

export const sectionTitle: CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em',
  margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6,
}

export const inputStyle: CSSProperties = {
  background: 'var(--surface-warm)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '9px 12px', fontSize: 14, color: 'var(--text-primary)', outline: 'none',
  width: '100%', fontFamily: 'inherit', letterSpacing: '-0.01em',
}

export function btn(kind: 'primary' | 'secondary' | 'danger' | 'ghost' = 'secondary', small = false): CSSProperties {
  const base: CSSProperties = {
    borderRadius: 8, padding: small ? '5px 11px' : '8px 14px', fontSize: small ? 12 : 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em', whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexShrink: 0,
  }
  switch (kind) {
    case 'primary':
      return { ...base, background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
    case 'danger':
      return { ...base, background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.28)' }
    case 'ghost':
      return { ...base, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid transparent' }
    default:
      return { ...base, background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
  }
}

export const listRow: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
  border: '1px solid var(--border-light)', borderRadius: 10, background: 'var(--surface-warm)',
}

export const emptyText: CSSProperties = {
  fontSize: 13, color: 'var(--text-tertiary)', margin: 0, padding: '6px 2px',
}

