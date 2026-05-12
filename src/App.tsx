import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import AuthPage from './components/auth/AuthPage'
import TimelineView from './components/timeline/TimelineView'
import { ToastProvider } from './components/ui/Toast'
import { requestAndNotify } from './lib/notifications'
import { useStore } from './store/useStore'

function AppInner() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const { tasks } = useStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // 通知: データ取得後に1回チェック
  useEffect(() => {
    if (tasks.length > 0) {
      requestAndNotify(tasks)
    }
  }, [tasks.length > 0])

  if (session === undefined) {
    return (
      <div style={{ height: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <style>{`@keyframes skPulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
        <div style={{ height: 52, background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--border)', animation: 'skPulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 46, height: 13, borderRadius: 6, background: 'var(--border)', animation: 'skPulse 1.5s ease-in-out 0.1s infinite' }} />
          <div style={{ flex: 1 }} />
          <div style={{ width: 92, height: 32, borderRadius: 8, background: 'var(--border)', animation: 'skPulse 1.5s ease-in-out 0.2s infinite' }} />
          <div style={{ width: 64, height: 32, borderRadius: 7, background: 'var(--border)', animation: 'skPulse 1.5s ease-in-out 0.3s infinite' }} />
        </div>
        <div style={{ height: 42, borderBottom: '1px solid var(--border-light)', background: 'var(--bg-secondary, var(--bg))', flexShrink: 0 }} />
        {[36, 52, 52, 36, 52, 52, 52].map((h, i) => (
          <div key={i} style={{ height: h, borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', padding: h === 36 ? '0 14px' : '0 30px', background: h === 36 ? 'var(--bg-secondary, var(--border-light))' : 'var(--surface)', gap: 14, flexShrink: 0 }}>
            <div style={{ width: h === 36 ? 56 : 88 + (i % 2) * 20, height: h === 36 ? 9 : 11, borderRadius: 5, background: 'var(--border)', animation: `skPulse 1.5s ease-in-out ${i * 0.08}s infinite` }} />
            {h !== 36 && <div style={{ width: 130 + (i % 3) * 40, height: 32, borderRadius: 6, background: 'var(--border)', animation: `skPulse 1.5s ease-in-out ${i * 0.12}s infinite` }} />}
          </div>
        ))}
      </div>
    )
  }

  if (!session) return <ToastProvider><AuthPage /></ToastProvider>
  return <ToastProvider><TimelineView /></ToastProvider>
}

export default function App() {
  return <AppInner />
}
