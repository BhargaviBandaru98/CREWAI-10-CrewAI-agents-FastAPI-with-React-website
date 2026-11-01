import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'dark' | 'light'
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    (document.documentElement.dataset.theme as Theme) === 'light' ? 'light' : 'dark',
  )
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#070B1A' : '#F5F6FF')
    try {
      localStorage.setItem('crewai-theme', theme)
    } catch {
      /* private mode */
    }
  }, [theme])
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)
