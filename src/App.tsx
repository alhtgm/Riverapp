import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import AuthPage from './components/auth/AuthPage'
import TimelineView from './components/timeline/TimelineView'
import { ToastProvider } from './components/ui/Toast'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Loading skeleton
  if (session === undefined) {
    return (
      <div style={{ height: '100svh', background: '#F6F3EE', display: 'flex', flexDirection: 'column' }}>
        <style>{`@keyframes skPulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
        {/* Header skeleton */}
        <div style={{ height: 52, background: 'rgba(246,243,238,0.88)', borderBottom: '1px solid #E3DDD5', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#E3DDD5', animation: 'skPulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 46, height: 13, borderRadius: 6, background: '#E3DDD5', animation: 'skPulse 1.5s ease-in-out 0.1s infinite' }} />
          <div style={{ flex: 1 }} />
          <div style={{ width: 92, height: 32, borderRadius: 8, background: '#E3DDD5', animation: 'skPulse 1.5s ease-in-out 0.2s infinite' }} />
          <div style={{ width: 64, height: 32, borderRadius: 7, background: '#E3DDD5', animation: 'skPulse 1.5s ease-in-out 0.3s infinite' }} />
        </div>
        {/* Filter bar skeleton */}
        <div style={{ height: 42, borderBottom: '1px solid #EDE8DF', background: '#F2EFE9', flexShrink: 0 }} />
        {/* Row skeletons */}
        {[36, 52, 52, 36, 52, 52, 52].map((h, i) => (
          <div key={i} style={{ height: h, borderBottom: '1px solid #EDE8DF', display: 'flex', alignItems: 'center', padding: h === 36 ? '0 14px' : '0 30px', background: h === 36 ? '#EDE8DF' : '#FFFFFF', gap: 14, flexShrink: 0 }}>
            <div style={{ width: h === 36 ? 56 : 88 + (i % 2) * 20, height: h === 36 ? 9 : 11, borderRadius: 5, background: '#E3DDD5', animation: `skPulse 1.5s ease-in-out ${i * 0.08}s infinite` }} />
            {h !== 36 && <div style={{ width: 130 + (i % 3) * 40, height: 32, borderRadius: 6, background: '#E3DDD5', animation: `skPulse 1.5s ease-in-out ${i * 0.12}s infinite` }} />}
          </div>
        ))}
      </div>
    )
  }

  if (!session) return <ToastProvider><AuthPage /></ToastProvider>
  return <ToastProvider><TimelineView /></ToastProvider>
}
