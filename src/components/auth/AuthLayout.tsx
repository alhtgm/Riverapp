import type { ReactNode } from 'react'
import '../ui/m3.css'

/**
 * ログイン・初回登録の共通の外枠。
 * 背景は選んだ色の濃いグラデーション、中央に M3 のカード（角 28px・影 Level 3）、上部に見出しの帯。
 */
export default function AuthLayout({ title, subtitle, children, footer }: {
  title: string
  subtitle: string
  children: ReactNode
  /** カードの下に出す小さな操作（ログイン ⇔ 登録の切り替えなど） */
  footer?: ReactNode
}) {
  return (
    <div style={{
      minHeight: '100svh',
      background: 'linear-gradient(145deg, var(--hero-1) 0%, var(--brand-deep) 50%, var(--hero-3) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-4)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 背景のやわらかい光（飾り） */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, pointerEvents: 'none',
        background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 15%, transparent) 0%, transparent 70%)',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', bottom: '-10%', right: '-5%', width: 500, height: 500, pointerEvents: 'none',
        background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 15%, transparent) 0%, transparent 70%)',
      }} />

      <main style={{
        background: 'var(--surface)',
        borderRadius: 'var(--shape-xl)',
        boxShadow: 'var(--elevation-3)',
        width: '100%',
        maxWidth: 420,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* 見出しの帯 */}
        <div style={{
          background: 'linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-header) 100%)',
          padding: 'var(--space-8) var(--space-6) var(--space-6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            <img src="/river-icon.png" width={40} height={40} alt="" style={{ borderRadius: 'var(--shape-md)', objectFit: 'cover' }} />
            <span style={{
              color: 'var(--on-brand)',
              fontSize: 'var(--type-title-large-size)', lineHeight: 'var(--type-title-large-line)',
              fontWeight: 'var(--type-weight-emphasized)',
            }}>
              River
            </span>
          </div>
          <h1 style={{
            margin: '0 0 var(--space-2)', color: 'var(--on-brand)',
            fontSize: 'var(--type-headline-medium-size)', lineHeight: 'var(--type-headline-medium-line)',
            fontWeight: 'var(--type-weight-emphasized)',
          }}>
            {title}
          </h1>
          <p style={{
            margin: 0, color: 'color-mix(in srgb, var(--on-brand) 80%, transparent)',
            fontSize: 'var(--type-body-medium-size)', lineHeight: 'var(--type-body-medium-line)',
          }}>
            {subtitle}
          </p>
        </div>

        <div style={{ padding: 'var(--space-6)' }}>
          {children}
          {footer && (
            <div style={{
              marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
              gap: 'var(--space-1)', color: 'var(--text-secondary)',
              fontSize: 'var(--type-body-medium-size)', lineHeight: 'var(--type-body-medium-line)',
            }}>
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
