import { useState } from 'react'
import { useStore } from '../../store/useStore'

/** 初回ログイン時のプロフィール作成（表示名とユーザーID）。大学の登録はあとからアカウント設定で任意に行う */
export default function Onboarding() {
  const completeOnboarding = useStore(s => s.completeOnboarding)
  const signOut = useStore(s => s.signOut)

  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await completeOnboarding(displayName, handle)
      // 完了後は profile がセットされ、App 側がタイムラインへ切り替える
    } catch (e: unknown) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    background: '#F6F5F1',
    border: '1px solid #DCDAE3',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 15,
    color: '#1C1917',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
  }
  const labelBase: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#544E48',
    letterSpacing: '-0.01em',
    marginBottom: 6,
  }
  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.style.borderColor = 'var(--accent)'
      e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)'
      e.target.style.background = '#FFFFFF'
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.style.borderColor = '#DCDAE3'
      e.target.style.boxShadow = 'none'
      e.target.style.background = '#F6F5F1'
    },
  }
  const primaryBtn = (disabled: boolean): React.CSSProperties => ({
    background: disabled ? '#6A6780' : 'linear-gradient(135deg, var(--accent-solid) 0%, var(--accent-solid-2) 100%)',
    color: 'var(--on-accent)',
    border: 'none',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 15,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    letterSpacing: '-0.02em',
    boxShadow: disabled ? 'none' : '0 4px 12px color-mix(in srgb, var(--accent) 35%, transparent)',
    transition: 'all 0.15s',
    marginTop: 4,
    fontFamily: 'inherit',
  })

  return (
    <div style={{
      minHeight: '100svh',
      background: 'linear-gradient(145deg, var(--hero-1) 0%, var(--brand-deep) 50%, var(--hero-3) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 15%, transparent) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: 500, height: 500, background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 15%, transparent) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{
        background: '#FFFFFF',
        borderRadius: 20,
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: 420,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Header band */}
        <div style={{ background: 'linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-header) 100%)', padding: '32px 36px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <img src="/river-icon.png" width={36} height={36} alt="River" style={{ borderRadius: 10, objectFit: 'cover', boxShadow: '0 4px 12px rgba(13,11,40,0.35)' }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--on-brand)', letterSpacing: '-0.04em' }}>River</span>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--on-brand)', letterSpacing: '-0.04em', margin: '0 0 6px', lineHeight: 1.15 }}>
            プロフィールを作成
          </h1>
          <p style={{ fontSize: 14, color: 'color-mix(in srgb, var(--on-brand) 75%, transparent)', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.5 }}>
            フレンドや講義の参加者に表示される名前とIDを決めましょう
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 36px 32px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelBase}>表示名</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                  maxLength={30}
                  style={inputBase}
                  placeholder="りばー太郎"
                  {...focusHandlers}
                />
                <p style={{ fontSize: 12, color: '#6A6780', margin: '8px 0 0', lineHeight: 1.5 }}>
                  本名やメールアドレスは他の人に表示されません。
                </p>
              </div>
              <div>
                <label style={labelBase}>ユーザーID</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6A6780', fontSize: 14 }}>@</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={e => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    required
                    minLength={3}
                    maxLength={20}
                    style={{ ...inputBase, paddingLeft: 28 }}
                    placeholder="river_taro"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    {...focusHandlers}
                  />
                </div>
                <p style={{ fontSize: 12, color: '#6A6780', margin: '8px 0 0', lineHeight: 1.5 }}>
                  英数字とアンダースコアで3〜20文字。フレンドはこのIDの完全一致で検索します。
                </p>
              </div>
              <p style={{ fontSize: 12, color: '#6A6780', margin: 0, lineHeight: 1.5 }}>
                大学の登録は任意です。あとから「アカウント設定」で登録できます。
              </p>

              {error && <ErrorBox message={error} />}

              <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                {loading ? '作成中...' : 'はじめる'}
              </button>
            </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6A6780', letterSpacing: '-0.01em' }}>
            <button
              onClick={() => signOut()}
              style={{ background: 'none', border: 'none', color: 'var(--accent-solid)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: 'inherit' }}
            >
              ログアウト
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#DC2626', letterSpacing: '-0.01em' }}>
      {message}
    </div>
  )
}
