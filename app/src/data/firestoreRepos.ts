import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'
import type { CollectionRepo, NotificationEntry, Profile, Repos } from './repos'

/** Firestore rejects `undefined`: on create drop such keys, on update delete the stored field. */
const forCreate = (input: object): DocumentData =>
  Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined))

const forUpdate = (input: object): DocumentData =>
  Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === undefined ? deleteField() : v]))

/** Firestore documents are limited to 1 MiB; leave room for field names. */
const MAX_LEGACY_CHARS = 900_000
const BATCH_SIZE = 400

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
    patch: (id, fields) => {
      updateDoc(doc(col, id), forUpdate(fields)).catch(onWriteError)
    },
  }
}

export function firestoreRepos(db: Firestore, uid: string, onWriteError: (e: Error) => void): Repos {
  const base = ['users', uid] as const
  const legacy = collection(db, ...base, 'legacy')
  return {
    students: repo(db, [...base, 'students'], onWriteError, () => ({ createdAt: Date.now() })),
    academies: repo(db, [...base, 'academies'], onWriteError),
    groups: repo(db, [...base, 'groups'], onWriteError),
    sessions: repo(db, [...base, 'sessions'], onWriteError),
    payments: repo(db, [...base, 'payments'], onWriteError),
    devices: repo(db, [...base, 'devices'], onWriteError),
    reminderMarks: repo(db, [...base, 'studentReminders'], onWriteError),
    gameContent: repo(db, [...base, 'gameContent'], onWriteError),
    notifications: {
      subscribe: (cb, onError) =>
        onSnapshot(
          query(collection(db, ...base, 'notifyLog'), where('at', '>=', Date.now() - 30 * 86_400_000), orderBy('at', 'desc')),
          (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as Omit<NotificationEntry, 'id'>), id: d.id }))),
          onError,
        ),
    },
    profile: {
      subscribe: (cb, onError) => onSnapshot(doc(db, ...base), (snap) => cb((snap.data() as Profile | undefined) ?? {}), onError),
      patch: (fields) => {
        setDoc(doc(db, ...base), fields, { merge: true }).catch(onWriteError)
      },
    },

    importAll: (data) => {
      const writes: [string, string, DocumentData][] = []
      for (const name of ['students', 'academies', 'groups', 'sessions', 'payments'] as const) {
        for (const { id, ...rest } of data[name] as { id: string }[]) writes.push([name, id, forCreate(rest)])
      }
      for (const [key, value] of Object.entries(data.legacy)) {
        const json = JSON.stringify(value)
        if (json.length <= MAX_LEGACY_CHARS) writes.push(['legacy', key, { json }])
        else console.warn(`legacy/${key} is too large to store (${json.length} chars); skipped`)
      }
      for (let i = 0; i < writes.length; i += BATCH_SIZE) {
        const batch = writeBatch(db)
        for (const [name, id, value] of writes.slice(i, i + BATCH_SIZE)) batch.set(doc(db, ...base, name, id), value)
        batch.commit().catch(onWriteError)
      }
    },

    loadLegacy: async () => {
      const snap = await getDocs(legacy)
      return Object.fromEntries(snap.docs.map((d) => [d.id, JSON.parse((d.data() as { json: string }).json)]))
    },
  }
}
