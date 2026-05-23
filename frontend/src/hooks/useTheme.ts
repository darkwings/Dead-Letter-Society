import { useEffect, useState } from 'react'

const STORAGE_KEY = 'dls-theme'

export type Theme = 'dark' | 'light'

function applyTheme(theme: Theme) {
  if (theme === 'light') {
    document.documentElement.classList.add('light')
  } else {
    document.documentElement.classList.remove('light')
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    const resolved = stored === 'light' ? 'light' : 'dark'
    applyTheme(resolved)
    return resolved
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = (t: Theme) => setThemeState(t)
  const toggle = () => setThemeState(t => t === 'dark' ? 'light' : 'dark')

  return { theme, setTheme, toggle }
}
