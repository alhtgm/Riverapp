import { useState } from 'react'
import { useStore } from '../../store/useStore'
import AuthLayout from './AuthLayout'
import { Notice } from '../ui/kit'
import { Button, TextField } from '../ui/m3'

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

  return (
    <AuthLayout
      title="プロフィールを作成"
      subtitle="フレンドや講義の参加者に表示される名前とIDを決めましょう"
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
        <TextField
          label="ユーザーID"
          prefix="@"
          value={handle}
          onChange={e => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
          required
          minLength={3}
          maxLength={20}
          placeholder="river_taro"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          supportingText="英数字とアンダースコアで3〜20文字。フレンドはこのIDの完全一致で検索します。"
        />
        <p style={{
          margin: 0, padding: '0 var(--space-4)', color: 'var(--text-secondary)',
          fontSize: 'var(--type-body-small-size)', lineHeight: 'var(--type-body-small-line)',
        }}>
          大学の登録は任意です。あとから「アカウント設定」で登録できます。
        </p>

        {error && <Notice tone="danger">{error}</Notice>}

        <Button type="submit" block loading={loading}>
          {loading ? '作成中' : 'はじめる'}
        </Button>
      </form>
    </AuthLayout>
  )
}
