import { useCallback, useEffect, useRef, useState } from 'react'

export interface SnackbarMessage {
  text: string
  /** 「元に戻す」など、1 つだけ置ける操作 */
  action?: { label: string; onClick: () => void }
}

/**
 * スナックバー（m3.tsx の <Snackbar>）の表示を管理する。画面下に短く知らせる。保存・削除などの結果に使う。
 * 操作があるときは長めに出す（4 秒 → 8 秒）。
 */
export function useSnackbar() {
  const [message, setMessage] = useState<SnackbarMessage | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const close = useCallback(() => { window.clearTimeout(timer.current); setMessage(null) }, [])
  const show = useCallback((next: SnackbarMessage) => {
    window.clearTimeout(timer.current)
    setMessage(next)
    timer.current = window.setTimeout(() => setMessage(null), next.action ? 8000 : 4000)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return { message, show, close }
}
