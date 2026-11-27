import type { Academy, AcademyInput } from '../domain/academy'
import type { Session, SessionInput } from '../domain/attendance'
import type { Payment, PaymentInput } from '../domain/dues'
import type { Group, GroupInput } from '../domain/schedule'
import type { Student, StudentInput } from '../domain/student'

export type Unsubscribe = () => void

/**
 * A live collection. Writes return immediately: Firestore applies them to the local cache
 * at once and syncs in the background, so the app never waits on the network.
 * `update` replaces every field of the input; a field set to `undefined` is removed.
 */
export type CollectionRepo<T extends { id: string }, I> = {
  subscribe: (cb: (list: T[]) => void, onError: (e: Error) => void) => Unsubscribe
  create: (input: I) => string
  update: (id: string, input: I) => void
  /** Creates or fully replaces the document with this id. */
  put: (id: string, input: I) => void
  remove: (id: string) => void
}

export type Repos = {
  students: CollectionRepo<Student, StudentInput>
  academies: CollectionRepo<Academy, AcademyInput>
  groups: CollectionRepo<Group, GroupInput>
  sessions: CollectionRepo<Session, SessionInput>
  payments: CollectionRepo<Payment, PaymentInput>
}
