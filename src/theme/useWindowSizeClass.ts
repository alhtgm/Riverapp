import { useEffect, useState } from 'react'
import { windowSizeClass, type WindowSizeClass } from './breakpoints'

/** いまの画面幅の区分（compact / medium / expanded / large / extraLarge）。幅が変わると更新される */
export function useWindowSizeClass(): WindowSizeClass {
  const [size, setSize] = useState<WindowSizeClass>(() => windowSizeClass(window.innerWidth))
  useEffect(() => {
    const onResize = () => setSize(windowSizeClass(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}
