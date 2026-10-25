import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { applyTheme, getStoredTheme } from '../lib/theme'
import { adminApi, fetchIsAdmin, type AdminStats } from '../lib/admin'
import AuthPage from '../components/auth/AuthPage'
import { ToastProvider } from '../components/ui/Toast'
import { Button, Card, EmptyState, Notice, Section, Tabs } from '../components/ui/kit'
import FeedbackTab from './FeedbackTab'
import UsersTab from './UsersTab'
import AnnouncementsTab from './AnnouncementsTab'

type AdminTab = 'overview' | 'feedback' | 'users' | 'announcements'

/**
 * /admin の管理者画面。admins 表に入っている人だけが使える。
 * データはすべて管理者向けの関数（admin_*）から読み、関数の中でも管理者かどうかを確かめている
 */
export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    applyTheme(getStoredTheme())
    document.title = 'River 管理者画面'
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let alive = true
    fetchIsAdmin().then(v => { if (alive) setIsAdmin(v) }).catch(() => { if (alive) setIsAdmin(false) })
    return () => { alive = false }
  }, [session])

  if (session === undefined) return <Blank />
  if (!session) return <ToastProvider><AuthPage /></ToastProvider>
  if (isAdmin === null) return <Blank />
  if (!isAdmin) {
    return (
      <Centered>
        <EmptyState
          title="この画面は管理者だけが使えます"
          description="管理者として登録されていないアカウントでログインしています。"
          action={
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button onClick={() => { window.location.href = '/' }}>アプリに戻る</Button>
              <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>ログアウト</Button>
            </div>
          }
        />
      </Centered>
    )
  }
  return <ToastProvider><AdminShell /></ToastProvider>
}

function Blank() {
  return <div style={{ minHeight: '100svh', background: 'var(--bg)' }} />
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>{children}</div>
    </div>
  )
}

function AdminShell() {
  const [tab, setTab] = useState<AdminTab>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)

  const loadStats = useCallback(() => {
    adminApi.stats().then(s => { setStats(s); setStatsError(null) }).catch(e => setStatsError((e as Error).message))
  }, [])
  useEffect(() => { loadStats() }, [loadStats])

  const openFeedback = (stats?.feedback_open ?? 0) + (stats?.feedback_in_progress ?? 0)

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '0 var(--space-4)', height: 64,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      }}>
        <img src="/river-icon.png" alt="" width={32} height={32} style={{ borderRadius: 8 }} />
        <span style={{ fontSize: 'var(--type-title-large-size)', fontWeight: 700 }}>River 管理者画面</span>
        <span style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/' }}>アプリに戻る</Button>
        <Button variant="ghost" size="sm" onClick={() => void supabase.auth.signOut()}>ログアウト</Button>
      </header>
      <div style={{ background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Tabs<AdminTab>
            value={tab}
            onChange={t => { setTab(t); loadStats() }}
            tabs={[
              { key: 'overview', label: 'まとめ' },
              { key: 'feedback', label: 'メッセージ', badge: openFeedback || undefined },
              { key: 'users', label: 'ユーザー' },
              { key: 'announcements', label: 'お知らせ' },
            ]}
          />
        </div>
      </div>
      <main style={{ maxWidth: 1120, margin: '0 auto', padding: 'var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {tab === 'overview' && <Overview stats={stats} error={statsError} onOpenFeedback={() => setTab('feedback')} />}
        {tab === 'feedback' && <FeedbackTab onChanged={loadStats} />}
        {tab === 'users' && <UsersTab onChanged={loadStats} />}
        {tab === 'announcements' && <AnnouncementsTab usersTotal={stats ? stats.users_total - stats.users_suspended : null} />}
      </main>
    </div>
  )
}

function Overview({ stats, error, onOpenFeedback }: { stats: AdminStats | null; error: string | null; onOpenFeedback: () => void }) {
  if (error) return <Notice tone="danger">{error}</Notice>
  if (!stats) return null
  return (
    <>
      <Section title="ユーザー">
        <StatGrid>
          <Stat label="登録しているユーザー" value={stats.users_total} />
          <Stat label="この7日間の新規登録" value={stats.users_new_7d} />
          <Stat label="この7日間にログインした人" value={stats.users_active_7d} />
          <Stat label="利用停止中" value={stats.users_suspended} />
        </StatGrid>
      </Section>
      <Section title="講義と課題">
        <StatGrid>
          <Stat label="講義" value={stats.lectures_total} />
          <Stat label="課題" value={stats.tasks_total} />
          <Stat label="この7日間に増えた課題" value={stats.tasks_new_7d} />
        </StatGrid>
      </Section>
      <Section
        title="開発者へのメッセージ"
        action={<Button size="sm" onClick={onOpenFeedback}>メッセージを見る</Button>}
      >
        <StatGrid>
          <Stat label="未対応" value={stats.feedback_open} highlight={stats.feedback_open > 0} />
          <Stat label="対応中" value={stats.feedback_in_progress} />
        </StatGrid>
      </Section>
    </>
  )
}

function StatGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>{children}</div>
}

function Stat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card tone={highlight ? 'accent' : 'default'}>
      <div style={{ fontSize: 'var(--type-label-large-size)', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, marginTop: 'var(--space-1)', fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString('ja-JP')}
      </div>
    </Card>
  )
}
