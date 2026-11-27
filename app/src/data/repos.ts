import type { Academy, AcademyInput } from '../domain/academy'
import type { Session, SessionInput } from '../domain/attendance'
import type { Payment, PaymentInput } from '../domain/dues'
import type { BackupData } from '../domain/importData'
import type { NotifySettings } from '../domain/reminders'
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
  /** Changes only the given fields; a field set to `undefined` is removed. */
  patch: (id: string, fields: Partial<Omit<T, 'id'>>) => void
}

/** The teacher's own settings document, users/{uid}. */
export type Profile = {
  notify?: NotifySettings
  /** Bell: notifications before this time (ms) count as read. */
  notifySeenAt?: number
  /** Working hours for the free-time view, Egypt time "HH:mm". */
  workHours?: { from: string; to: string }
}

/** When a student reminder was sent, users/{uid}/studentReminders/{key}. */
export type ReminderMark = { id: string; sentAt: number }

/** A reminder the sender delivered, users/{uid}/notifyLog/{key}. */
export type NotificationEntry = { id: string; date: string; at: number; title?: string; body?: string; url?: string; delivered?: number }

/** A browser that receives reminders, users/{uid}/devices/{token}. */
export type Device = { id: string; token: string; label: string; createdAt: number }

export type ProfileRepo = {
  subscribe: (cb: (p: Profile) => void, onError: (e: Error) => void) => Unsubscribe
  patch: (fields: Partial<Profile>) => void
}

export type Repos = {
  students: CollectionRepo<Student, StudentInput>
  academies: CollectionRepo<Academy, AcademyInput>
  groups: CollectionRepo<Group, GroupInput>
  sessions: CollectionRepo<Session, SessionInput>
  payments: CollectionRepo<Payment, PaymentInput>
  devices: CollectionRepo<Device, Omit<Device, 'id'>>
  reminderMarks: CollectionRepo<ReminderMark, Omit<ReminderMark, 'id'>>
  profile: ProfileRepo
  /** Delivered reminders of the last 30 days, newest first. */
  notifications: { subscribe: (cb: (list: NotificationEntry[]) => void, onError: (e: Error) => void) => Unsubscribe }
  /** Writes a whole backup (keeping ids, so importing twice does not duplicate). Returns at once. */
  importAll: (data: BackupData) => void
  /** Old-site data kept for later versions (plans, progress, marks). */
  loadLegacy: () => Promise<Record<string, unknown>>
}
