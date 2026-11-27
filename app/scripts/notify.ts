/**
 * Lesson reminder sender. Runs every few minutes on GitHub Actions (.github/workflows/notify.yml):
 * for each teacher with registered devices, works out which reminders are due right now
 * (same rules as the app, src/domain/reminders.ts) and pushes them through FCM.
 *
 * Needs FIREBASE_SERVICE_ACCOUNT (the service account JSON). DRY_RUN=1 prints instead of sending.
 */
import { cert, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import type { Academy } from '../src/domain/academy'
import type { Session } from '../src/domain/attendance'
import { DEFAULT_NOTIFY, dueReminders, type NotifySettings } from '../src/domain/reminders'
import type { Group } from '../src/domain/schedule'
import type { Student } from '../src/domain/student'
import { dateInZone, timeInZone } from '../src/domain/zone'

const TZ = 'Africa/Cairo'
const DRY_RUN = process.env.DRY_RUN === '1'
const STALE_TOKEN = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'])

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) {
    console.log('FIREBASE_SERVICE_ACCOUNT is not set; nothing to do.')
    return
  }
  initializeApp({ credential: cert(JSON.parse(raw) as ServiceAccount) })
  const db = getFirestore()
  const messaging = getMessaging()

  const now = new Date()
  const today = dateInZone(now, TZ)
  const nowTime = timeInZone(now, TZ)
  // Nobody needs reminders in the small hours; skip the reads.
  if (nowTime < '05:00') {
    console.log(`${today} ${nowTime}: quiet hours.`)
    return
  }

  const users = await db.collection('users').listDocuments()
  let sentCount = 0
  for (const user of users) {
    const devices = await user.collection('devices').get()
    if (devices.empty) continue

    const [profile, groupsSnap, studentsSnap, sessionsSnap, logSnap, academiesSnap] = await Promise.all([
      user.get(),
      user.collection('groups').get(),
      user.collection('students').get(),
      user.collection('sessions').where('date', '==', today).get(),
      user.collection('notifyLog').where('date', '==', today).get(),
      user.collection('academies').get(),
    ])
    // Student reminders the teacher already sent from the app (keys contain the lesson date).
    const marksSnap = await user.collection('studentReminders').where('sentAt', '>=', Date.now() - 2 * 86_400_000).get()
    const settings: NotifySettings = { ...DEFAULT_NOTIFY, ...(profile.data()?.notify as Partial<NotifySettings> | undefined) }
    const due = dueReminders({
      today,
      nowTime,
      groups: groupsSnap.docs.map((d) => ({ ...(d.data() as Omit<Group, 'id'>), id: d.id })),
      students: studentsSnap.docs.map((d) => ({ ...(d.data() as Omit<Student, 'id'>), id: d.id })),
      sessions: sessionsSnap.docs.map((d) => ({ ...(d.data() as Omit<Session, 'id'>), id: d.id })),
      settings,
      sent: new Set(logSnap.docs.map((d) => d.id)),
      academies: academiesSnap.docs.map((d) => ({ ...(d.data() as Omit<Academy, 'id'>), id: d.id })),
      marked: new Set(marksSnap.docs.map((d) => d.id)),
    })
    if (!due.length) continue

    const tokens = devices.docs.map((d) => d.id)
    for (const r of due) {
      if (DRY_RUN) {
        console.log(`[dry run] ${user.id}: ${r.title} — ${r.body}`)
        continue
      }
      const res = await messaging.sendEachForMulticast({
        tokens,
        webpush: {
          headers: { Urgency: 'high', TTL: '1800' },
          data: { title: r.title, body: r.body, url: r.url, tag: r.key },
        },
      })
      // Forget browsers that no longer accept pushes.
      await Promise.all(
        res.responses.map((x, i) => (!x.success && STALE_TOKEN.has(x.error?.code ?? '') ? user.collection('devices').doc(tokens[i]).delete() : null)),
      )
      // Log by key so the next run does not send it again; the app shows this log under the bell.
      await user.collection('notifyLog').doc(r.key).set({ date: today, at: Date.now(), delivered: res.successCount, title: r.title, body: r.body, url: r.url })
      sentCount += res.successCount
    }
  }
  console.log(`${today} ${nowTime}: ${sentCount} notification(s) delivered.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
