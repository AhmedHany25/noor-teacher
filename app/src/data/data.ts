import { createContext, useContext, useEffect, useState } from 'react'
import type { Academy } from '../domain/academy'
import type { Session } from '../domain/attendance'
import type { Payment } from '../domain/dues'
import type { Group } from '../domain/schedule'
import type { Student } from '../domain/student'
import type { CollectionRepo, Repos } from './repos'

export type DataContextValue = {
  repos: Repos
  notify: (message: string) => void
}

export const DataContext = createContext<DataContextValue | null>(null)

/** Dispatched on window when a background Firestore write is rejected. */
export const WRITE_ERROR_EVENT = 'noor:write-error'

export function reportWriteError(e: Error) {
  console.error('Firestore write failed', e)
  window.dispatchEvent(new Event(WRITE_ERROR_EVENT))
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}

export type Live<T> = { items: T[]; loading: boolean }

function useLive<T extends { id: string }>(repo: CollectionRepo<T, never>): Live<T> {
  const { notify } = useData()
  const [state, setState] = useState<Live<T>>({ items: [], loading: true })
  const subscribe = repo.subscribe
  useEffect(
    () =>
      subscribe(
        (items) => setState({ items, loading: false }),
        () => {
          setState((s) => ({ ...s, loading: false }))
          notify('تعذّر تحميل البيانات. تأكد من الاتصال ثم أعد فتح التطبيق.')
        },
      ),
    [subscribe, notify],
  )
  return state
}

export const useStudents = (): Live<Student> => useLive(useData().repos.students)
export const useAcademies = (): Live<Academy> => useLive(useData().repos.academies)
export const useGroups = (): Live<Group> => useLive(useData().repos.groups)
export const useSessions = (): Live<Session> => useLive(useData().repos.sessions)
export const usePayments = (): Live<Payment> => useLive(useData().repos.payments)
