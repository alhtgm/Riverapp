import { useState } from 'react'
import { useStore } from '../../store/useStore'
import AuthLayout from './AuthLayout'
import { Notice } from '../ui/kit'
import { Button, SelectField, TextField } from '../ui/m3'
import { currentSemester, SEMESTER_TERM_LABEL, SEMESTER_TERMS, type SemesterTerm } from '../../lib/semester'

/**
 * 初回ログイン時のプロフィール作成（表示名と、今の年度・学期）。ユーザーIDは自動で決まり、あとから変更できない。
 * 学期は日付から推測せず本人に選んでもらい、最初に開く学期にする。
 * 大学の登録はあとからアカウント設定で任意に行う
 */
export default function Onboarding() {
  const completeOnboarding = useStore(s => s.completeOnboarding)
  const signOut = useStore(s => s.signOut)

  const [displayName, setDisplayName] = useState('')
  const [year, setYear] = useState('')
  const [term, setTerm] = useState<SemesterTerm | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 年度の候補は今の年度の前後1年
  const nowYear = currentSemester().year
  const years = [nowYear - 1, nowYear, nowYear + 1]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!year || !term) {
      setError('今の年度と学期を選んでください')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await completeOnboarding(displayName, { year: Number(year), term })
      // 完了後は profile がセットされ、App 側がタイムラインへ切り替える
    } catch (e: unknown) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="プロフィールを作成"
      subtitle="表示される名前と、今の年度・学期を決めましょう"
      footer={<Button variant="text" size="xs" onClick={() => signOut()}>ログアウト</Button>}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <TextField
          label="表示名"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          required
          maxLength={30}
          placeholder="りばー太郎"
          supportingText="本名やメールアドレスは他の人に表示されません。"
        />
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <div style={{ flex: 1 }}>
            <SelectField label="今の年度" value={year} onChange={e => setYear(e.target.value)} required>
              <option value="" disabled>選んでください</option>
              {years.map(y => <option key={y} value={y}>{y}年度</option>)}
            </SelectField>
          </div>
          <div style={{ flex: 1 }}>
            <SelectField label="今の学期" value={term} onChange={e => setTerm(e.target.value as SemesterTerm)} required>
              <option value="" disabled>選んでください</option>
              {SEMESTER_TERMS.map(t => <option key={t} value={t}>{SEMESTER_TERM_LABEL[t]}</option>)}
            </SelectField>
          </div>
        </div>
        <p style={{
          margin: 0, padding: '0 var(--space-4)', color: 'var(--text-secondary)',
          fontSize: 'var(--type-body-small-size)', lineHeight: 'var(--type-body-small-line)',
        }}>
          フレンド検索に使うユーザーIDは自動で決まります（あとから変更はできません）。
          大学の登録は任意で、あとから「アカウント設定」で登録できます。
        </p>

        {error && <Notice tone="danger">{error}</Notice>}

        <Button type="submit" block loading={loading}>
          {loading ? '作成中' : 'はじめる'}
        </Button>
      </form>
    </AuthLayout>
  )
}
