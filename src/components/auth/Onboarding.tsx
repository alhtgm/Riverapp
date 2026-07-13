import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'

type Step = 'school' | 'name'

export default function Onboarding() {
  const completeOnboarding = useStore(s => s.completeOnboarding)
  const signOut = useStore(s => s.signOut)

  const [step, setStep] = useState<Step>('school')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 2: 学校メアドのドメインを許可リストと照合
  const handleSchoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const email = schoolEmail.trim().toLowerCase()
      const domain = email.split('@')[1] ?? ''
      if (!domain) throw new Error('メールアドレスの形式が正しくありません')

      const { data, error } = await supabase
        .from('school_domains')
        .select('school_id, schools(name)')
        .eq('domain', domain)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error(`未対応の学校ドメインです（${domain}）`)

      // @ts-expect-error supabase の join 結果はネスト型
      setSchoolName(data.schools?.name ?? null)
      setStep('name')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Step 3: 表示名を決めて profiles を作成
  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await completeOnboarding(schoolEmail, displayName)
      // 完了後は profile がセットされ、App 側がタイムラインへ切り替える
    } catch (e: unknown) {
      setError((e as Error).message)
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
  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.style.borderColor = '#E06E42'
      e.target.style.boxShadow = '0 0 0 3px rgba(224,110,66,0.18)'
      e.target.style.background = '#FFFFFF'
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.style.borderColor = '#E3DDD5'
      e.target.style.boxShadow = 'none'
      e.target.style.background = '#FAFAF8'
    },
  }
  const primaryBtn = (disabled: boolean): React.CSSProperties => ({
    background: disabled ? '#7D766E' : 'linear-gradient(135deg, #E06E42 0%, #C2582F 100%)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 15,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    letterSpacing: '-0.02em',
    boxShadow: disabled ? 'none' : '0 4px 12px rgba(224,110,66,0.35)',
    transition: 'all 0.15s',
    marginTop: 4,
    fontFamily: 'inherit',
  })

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
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(224,110,66,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(112,135,127,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

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
        <div style={{ background: 'linear-gradient(135deg, #2f2963 0%, #454372 100%)', padding: '32px 36px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <img src="/river-icon.png" width={36} height={36} alt="River" style={{ borderRadius: 10, objectFit: 'cover', boxShadow: '0 4px 12px rgba(112,135,127,0.4)' }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.04em' }}>River</span>
          </div>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
            {(['school', 'name'] as Step[]).map(s => (
              <div key={s} style={{
                height: 4, flex: 1, borderRadius: 2,
                background: (step === s || (step === 'name' && s === 'school')) ? '#E06E42' : 'rgba(255,255,255,0.2)',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.04em', margin: '0 0 6px', lineHeight: 1.15 }}>
            {step === 'school' ? '学校を登録' : 'コミュニティ表示名'}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.5 }}>
            {step === 'school'
              ? '学校のメールアドレスで所属を判定します'
              : '他の人に表示される名前を決めましょう'}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 36px 32px' }}>
          {step === 'school' ? (
            <form onSubmit={handleSchoolSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelBase}>学校のメールアドレス</label>
                <input
                  type="email"
                  value={schoolEmail}
                  onChange={e => setSchoolEmail(e.target.value)}
                  required
                  style={inputBase}
                  placeholder="you@s.yourschool.ac.jp"
                  {...focusHandlers}
                />
                <p style={{ fontSize: 12, color: '#7D766E', margin: '8px 0 0', lineHeight: 1.5 }}>
                  ログインには使いません。所属する学校の判定だけに使います。
                </p>
              </div>

              {error && <ErrorBox message={error} />}

              <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                {loading ? '確認中...' : '次へ'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleNameSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {schoolName && (
                <div style={{ background: '#ECFDF5', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#16A34A', letterSpacing: '-0.01em' }}>
                  所属: {schoolName}
                </div>
              )}
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
                <p style={{ fontSize: 12, color: '#7D766E', margin: '8px 0 0', lineHeight: 1.5 }}>
                  本名やメールアドレスは他の人に表示されません。
                </p>
              </div>

              {error && <ErrorBox message={error} />}

              <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                {loading ? '作成中...' : 'はじめる'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('school'); setError(null) }}
                style={{ background: 'none', border: 'none', color: '#7D766E', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
              >
                ← 戻る
              </button>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#7D766E', letterSpacing: '-0.01em' }}>
            <button
              onClick={() => signOut()}
              style={{ background: 'none', border: 'none', color: '#E06E42', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: 'inherit' }}
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
