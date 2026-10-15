import type { ReactNode } from 'react'

export default function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--text-tertiary)',
      letterSpacing: '0.08em',
      marginBottom: 8,
    }}>
      {children}
    </div>
  )
}
