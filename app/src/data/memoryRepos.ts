import type { Academy } from '../domain/academy'
import type { Session } from '../domain/attendance'
import type { Payment } from '../domain/dues'
import type { Group } from '../domain/schedule'
import type { Student } from '../domain/student'
import type { CollectionRepo, Repos } from './repos'

type Store<T> = { all: () => T[] }

function memRepo<T extends { id: string }, I extends object>(
  prefix: string,
  seed: T[],
  onCreate: () => object = () => ({}),
): CollectionRepo<T, I> & Store<T> {
  let items = [...seed]
  const listeners = new Set<(l: T[]) => void>()
  const emit = () => listeners.forEach((l) => l([...items]))
  const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
  let n = 0
  return {
    all: () => [...items],
    subscribe: (cb) => {
      listeners.add(cb)
      cb([...items])
      return () => {
        listeners.delete(cb)
      }
    },
    create: (input) => {
      const id = `${prefix}${++n}`
      items.push({ ...clean(input), ...onCreate(), id } as unknown as T)
      emit()
      return id
    },
    update: (id, input) => {
      items = items.map((x) => {
        if (x.id !== id) return x
        const next: Record<string, unknown> = { ...x, ...input }
        for (const [k, v] of Object.entries(input)) if (v === undefined) delete next[k]
        return next as T
      })
      emit()
    },
    put: (id, input) => {
      const next = { ...clean(input), id } as unknown as T
      items = items.some((x) => x.id === id) ? items.map((x) => (x.id === id ? next : x)) : [...items, next]
      emit()
    },
    remove: (id) => {
      items = items.filter((x) => x.id !== id)
      emit()
    },
  }
}

/** In-memory repos with the same contract as Firestore, for tests. */
export function memoryRepos(
  seed: { students?: Student[]; academies?: Academy[]; groups?: Group[]; sessions?: Session[]; payments?: Payment[] } = {},
) {
  return {
    students: memRepo<Student, Omit<Student, 'id' | 'createdAt'>>('s', seed.students ?? [], () => ({ createdAt: 1 })),
    academies: memRepo<Academy, Omit<Academy, 'id'>>('a', seed.academies ?? []),
    groups: memRepo<Group, Omit<Group, 'id'>>('g', seed.groups ?? []),
    sessions: memRepo<Session, Omit<Session, 'id'>>('x', seed.sessions ?? []),
    payments: memRepo<Payment, Omit<Payment, 'id'>>('p', seed.payments ?? []),
  } satisfies Repos
}
