import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { DataContext, WRITE_ERROR_EVENT } from './data'
import type { Repos } from './repos'

/** Provides the data repos and a small toast for confirmations and errors. */
export function DataProvider({ repos, children }: { repos: Repos; children: ReactNode }) {
  const [toast, setToast] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const notify = useCallback((message: string) => {
    setToast(message)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(''), 3000)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  // Background writes that the server rejects (e.g. a rules failure) surface here.
  useEffect(() => {
    const onFail = () => notify('تعذّر حفظ آخر تعديل على السحابة. أعد المحاولة، وإن تكرر سجّل الخروج ثم الدخول.')
    window.addEventListener(WRITE_ERROR_EVENT, onFail)
    return () => window.removeEventListener(WRITE_ERROR_EVENT, onFail)
  }, [notify])

  return (
    <DataContext.Provider value={{ repos, notify }}>
      {children}
      <div className="toast" role="status" aria-live="polite" hidden={!toast}>
        {toast}
      </div>
    </DataContext.Provider>
  )
}
