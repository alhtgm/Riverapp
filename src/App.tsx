import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import AuthPage from './components/auth/AuthPage'
import TimelineView from './components/timeline/TimelineView'

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

  // Loading
  if (session === undefined) {
    return (
      <div
        style={{
          height: '100svh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f6f5f4',
        }}
      >
        <div style={{ color: '#a39e98', fontSize: 14 }}>読み込み中...</div>
      </div>
    )
  }

  if (!session) return <AuthPage />
  return <TimelineView />
}
