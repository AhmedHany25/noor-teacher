import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'
import type { CollectionRepo, Repos } from './repos'

/** Firestore rejects `undefined`: on create drop such keys, on update delete the stored field. */
const forCreate = (input: object): DocumentData =>
  Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined))

const forUpdate = (input: object): DocumentData =>
  Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === undefined ? deleteField() : v]))

function repo<T extends { id: string }, I extends object>(
  db: Firestore,
  path: string[],
  onWriteError: (e: Error) => void,
  extraOnCreate: () => DocumentData = () => ({}),
): CollectionRepo<T, I> {
  const col = collection(db, path[0], ...path.slice(1))
  return {
    subscribe: (cb, onError) =>
      onSnapshot(col, (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Omit<T, 'id'>), id: d.id }) as T)), onError),
    create: (input) => {
      const ref = doc(col)
      setDoc(ref, { ...forCreate(input), ...extraOnCreate() }).catch(onWriteError)
      return ref.id
    },
    update: (id, input) => {
      updateDoc(doc(col, id), forUpdate(input)).catch(onWriteError)
    },
    put: (id, input) => {
      setDoc(doc(col, id), forCreate(input)).catch(onWriteError)
    },
    remove: (id) => {
      deleteDoc(doc(col, id)).catch(onWriteError)
    },
  }
}

export function firestoreRepos(db: Firestore, uid: string, onWriteError: (e: Error) => void): Repos {
  const base = ['users', uid]
  return {
    students: repo(db, [...base, 'students'], onWriteError, () => ({ createdAt: Date.now() })),
    academies: repo(db, [...base, 'academies'], onWriteError),
    groups: repo(db, [...base, 'groups'], onWriteError),
    sessions: repo(db, [...base, 'sessions'], onWriteError),
    payments: repo(db, [...base, 'payments'], onWriteError),
  }
}
