export type ThemeMode = 'light' | 'dark'

export function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem('river-theme') as ThemeMode | null
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode)
  localStorage.setItem('river-theme', mode)
}

export function initTheme() {
  applyTheme(getStoredTheme())
}
