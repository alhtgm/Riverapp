import { useState } from 'react'
import { supabase } from '../../lib/supabase'


export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('確認メールを送信しました。メールを確認してください。')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    background: '#FAFAF8',
    border: '1px solid #E3DDD5',
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

  return (
    <div style={{
      minHeight: '100svh',
      background: 'linear-gradient(145deg, #1a1235 0%, #2f2963 50%, #1e1845 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Ambient glows */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '-10%',
        width: 600,
        height: 600,
        background: 'radial-gradient(circle, rgba(224,110,66,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-5%',
        width: 500,
        height: 500,
        background: 'radial-gradient(circle, rgba(112,135,127,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
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

        {/* Card header band */}
        <div style={{
          background: 'linear-gradient(135deg, #2f2963 0%, #454372 100%)',
          padding: '32px 36px 28px',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <img
              src="/river-icon.png"
              width={36}
              height={36}
              alt="River"
              style={{ borderRadius: 10, objectFit: 'cover', boxShadow: '0 4px 12px rgba(112,135,127,0.4)' }}
            />
            <span style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.04em',
            }}>
              River
            </span>
          </div>

          <h1 style={{
            fontSize: 26,
            fontWeight: 700,
            color: '#FFFFFF',
            letterSpacing: '-0.04em',
            margin: '0 0 6px',
            lineHeight: 1.1,
          }}>
            {mode === 'login' ? 'ようこそ' : 'はじめましょう'}
          </h1>
          <p style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.75)',
            margin: 0,
            letterSpacing: '-0.01em',
            lineHeight: 1.5,
          }}>
            {mode === 'login'
              ? 'どの端末からでもログインして課題を管理'
              : 'アカウントを作成してどこからでもアクセス'}
          </p>
        </div>

        {/* Form body */}
        <div style={{ padding: '28px 36px 32px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <label style={labelBase}>普段使いのメールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputBase}
                placeholder="you@example.com"
                onFocus={e => {
                  e.target.style.borderColor = '#E06E42'
                  e.target.style.boxShadow = '0 0 0 3px rgba(224,110,66,0.18)'
                  e.target.style.background = '#FFFFFF'
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#E3DDD5'
                  e.target.style.boxShadow = 'none'
                  e.target.style.background = '#FAFAF8'
                }}
              />
            </div>

            <div>
              <label style={labelBase}>パスワード</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                style={inputBase}
                placeholder="6文字以上"
                onFocus={e => {
                  e.target.style.borderColor = '#E06E42'
                  e.target.style.boxShadow = '0 0 0 3px rgba(224,110,66,0.18)'
                  e.target.style.background = '#FFFFFF'
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#E3DDD5'
                  e.target.style.boxShadow = 'none'
                  e.target.style.background = '#FAFAF8'
                }}
              />
            </div>

            {error && (
              <div style={{
                background: '#FEF2F2',
                border: '1px solid rgba(220,38,38,0.2)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 13,
                color: '#DC2626',
                letterSpacing: '-0.01em',
              }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{
                background: '#ECFDF5',
                border: '1px solid rgba(22,163,74,0.2)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 13,
                color: '#16A34A',
                letterSpacing: '-0.01em',
              }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#7D766E' : 'linear-gradient(135deg, #E06E42 0%, #C2582F 100%)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.02em',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(224,110,66,0.35)',
                transition: 'all 0.15s',
                marginTop: 4,
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 18px rgba(224,110,66,0.48)'
                  ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={e => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(224,110,66,0.35)'
                  ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
                }
              }}
            >
              {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウントを作成'}
            </button>
          </form>

          <p style={{
            textAlign: 'center',
            marginTop: 20,
            fontSize: 13,
            color: '#7D766E',
            letterSpacing: '-0.01em',
          }}>
            {mode === 'login' ? 'アカウントをお持ちでない方は ' : 'すでにアカウントをお持ちの方は '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setMessage(null) }}
              style={{
                background: 'none',
                border: 'none',
                color: '#E06E42',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                padding: 0,
                letterSpacing: '-0.01em',
                fontFamily: 'inherit',
              }}
            >
              {mode === 'login' ? 'こちら' : 'ログイン'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
