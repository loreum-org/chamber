import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type DocsNavContextValue = {
  isActive: boolean
  setIsActive: (active: boolean) => void
  mobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
  toggleMobile: () => void
}

const DocsNavContext = createContext<DocsNavContextValue | null>(null)

export function DocsNavProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])
  const toggleMobile = useCallback(() => setMobileOpen((open) => !open), [])

  const value = useMemo(
    () => ({ isActive, setIsActive, mobileOpen, openMobile, closeMobile, toggleMobile }),
    [isActive, mobileOpen, openMobile, closeMobile, toggleMobile],
  )

  return <DocsNavContext.Provider value={value}>{children}</DocsNavContext.Provider>
}

export function useDocsNav(): DocsNavContextValue | null {
  return useContext(DocsNavContext)
}
