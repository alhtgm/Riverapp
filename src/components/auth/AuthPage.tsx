import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'
import { Notice } from '../ui/kit'
import { Button, TextField } from '../ui/m3'

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

  return (
    <AuthLayout
      title={mode === 'login' ? 'ようこそ' : 'はじめましょう'}
      subtitle={mode === 'login'
        ? 'どの端末からでもログインして課題を管理'
        : 'アカウントを作成してどこからでもアクセス'}
      footer={<>
        {mode === 'login' ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は'}
        <Button
          variant="text"
          size="xs"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setMessage(null) }}
        >
          {mode === 'login' ? 'こちら（新規登録）' : 'ログイン'}
        </Button>
      </>}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <TextField
          label="普段使いのメールアドレス"
          type="email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />
        <TextField
          label="パスワード"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          placeholder="6文字以上"
        />

        {error && <Notice tone="danger">{error}</Notice>}
        {message && <Notice tone="info">{message}</Notice>}

        <Button type="submit" block loading={loading}>
          {loading ? '処理中' : mode === 'login' ? 'ログイン' : 'アカウントを作成'}
        </Button>
      </form>
    </AuthLayout>
  )
}
