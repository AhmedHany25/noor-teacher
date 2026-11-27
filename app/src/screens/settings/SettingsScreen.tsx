import { PageHeader } from '../../components/PageHeader'
import { useState, type ChangeEvent } from 'react'
import { useAuth } from '../../auth/auth'
import { useAcademies, useData, useGroups, usePayments, useSessions, useStudents } from '../../data/data'
import { DEFAULT_BASE_CURRENCY } from '../../domain/dues'
import { exportBackup, parseBackup, type BackupData, type ImportSummary } from '../../domain/importData'
import { useClock } from '../../lib/clock'
import { toArabicDigits } from '../../lib/format'
import { deviceLabel, pushSupported, testNotification } from '../../lib/pushSupport'
import { getTheme, setTheme, type Theme } from '../../lib/theme'
import { NotificationsSection, type PushApi } from './NotificationsSection'

const pushApi: PushApi = {
  supported: pushSupported,
  enable: () => import('../../lib/push').then((m) => m.enablePush()),
  test: testNotification,
  label: () => deviceLabel(),
}

export function SettingsScreen() {
  const auth = useAuth()
  if (auth.status !== 'signedIn') return null
  const { user } = auth

  return (
    <>
      <PageHeader title="الإعدادات" />
      <section className="account" aria-label="الحساب">
        {user.photoUrl && <img className="account-photo" src={user.photoUrl} alt="" referrerPolicy="no-referrer" />}
        <div className="account-text">
          <strong>{user.name}</strong>
          {user.email && <span>{user.email}</span>}
        </div>
        <button className="btn btn-quiet" onClick={() => void auth.signOut()}>
          تسجيل الخروج
        </button>
      </section>

      <NotificationsSection push={pushApi} />
      <AppearanceSection />
      <ImportSection />
      <BackupSection />
    </>
  )
}

function ImportSection() {
  const { repos, notify } = useData()
  const { items: students } = useStudents()
  const [pending, setPending] = useState<{ data: BackupData; summary: ImportSummary; source: 'old' | 'new' } | null>(null)
  const [error, setError] = useState('')

  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = '' // allow choosing the same file again
    if (!f) return
    setError('')
    setPending(null)
    const r = parseBackup(await f.text(), DEFAULT_BASE_CURRENCY)
    if (!r.ok) setError(r.error)
    else if (r.summary.students === 0 && r.summary.groups === 0) setError('الملف فاضي: مفيش طلاب ولا حلقات فيه.')
    else setPending({ data: r.data, summary: r.summary, source: r.source })
  }

  function confirm() {
    if (!pending) return
    repos.importAll(pending.data)
    setPending(null)
    notify('تم استيراد البيانات')
  }

  const n = (x: number) => toArabicDigits(x)

  return (
    <section className="settings-block">
      <h2 className="section-title">نقل بياناتك من الموقع القديم</h2>
      <p className="field-hint settings-hint">
        في الموقع القديم افتح الإعدادات ونزّل النسخة الاحتياطية، وبعدها اختار الملف هنا. الموقع القديم مش هيتأثر، وتقدر تكرر
        الاستيراد من غير ما البيانات تتكرر.
      </p>
      <label className="btn btn-quiet file-btn">
        اختيار ملف
        <input type="file" accept=".json,application/json" aria-label="اختيار ملف النسخة الاحتياطية" onChange={choose} />
      </label>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {pending && (
        <section className="import-summary" aria-label="ملخص الاستيراد">
          <p>
            <strong>{pending.source === 'old' ? 'نسخة من الموقع القديم' : 'نسخة من التطبيق ده'}</strong> وفيها:
          </p>
          <ul>
            <li>{n(pending.summary.students)} طالب</li>
            <li>{n(pending.summary.academies)} أكاديمية</li>
            <li>{n(pending.summary.groups)} حلقة</li>
            <li>{n(pending.summary.sessions)} حصة مسجلة</li>
            {pending.summary.payments > 0 && <li>{n(pending.summary.payments)} مبلغ مستلم</li>}
          </ul>
          {students.length > 0 && (
            <p className="import-warning">
              عندك {n(students.length)} طالب في التطبيق بالفعل. اللي أضفتهم هنا بنفسك هيفضلوا، فلو نفس الطلاب موجودين في الملف ممكن
              يتكرروا.
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={confirm}>
              استيراد
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setPending(null)}>
              إلغاء
            </button>
          </div>
        </section>
      )}
    </section>
  )
}

function BackupSection() {
  const { repos, notify } = useData()
  const { today } = useClock()
  const live = [useStudents(), useAcademies(), useGroups(), useSessions(), usePayments()]
  const ready = live.every((l) => !l.loading)
  const [students, academies, groups, sessions, payments] = live.map((l) => l.items)

  async function download() {
    let legacy: Record<string, unknown> = {}
    try {
      legacy = await repos.loadLegacy()
    } catch {
      // Offline with nothing cached: the backup still has everything else.
    }
    const data = { students, academies, groups, sessions, payments, legacy } as BackupData
    const blob = new Blob([exportBackup(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `noor-backup-${today}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify('تم تنزيل النسخة الاحتياطية')
  }

  return (
    <section className="settings-block">
      <h2 className="section-title">نسخة احتياطية</h2>
      <p className="field-hint settings-hint">
        بياناتك متزامنة على حسابك تلقائيًا. النسخة دي أمان زيادة: ملف فيه كل حاجة، تقدر ترجّعه من «اختيار ملف» فوق في أي وقت.
      </p>
      <button type="button" className="btn btn-quiet" onClick={download} disabled={!ready}>
        تنزيل نسخة احتياطية
      </button>
    </section>
  )
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'auto', label: 'تلقائي' },
  { value: 'light', label: 'فاتح' },
  { value: 'dark', label: 'ليلي' },
]

function AppearanceSection() {
  const [theme, setChoice] = useState<Theme>(getTheme)

  function choose(t: Theme) {
    setChoice(t)
    setTheme(t)
  }

  return (
    <section className="settings-block">
      <h2 className="section-title">المظهر</h2>
      <fieldset className="field">
        <legend className="sr-only">الثيم</legend>
        <div className="segmented">
          {THEMES.map((t) => (
            <label key={t.value} className="segment">
              <input type="radio" name="theme" checked={theme === t.value} onChange={() => choose(t.value)} />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="field-hint settings-hint">«تلقائي» بيمشي مع إعداد الموبايل أو الكمبيوتر. الاختيار محفوظ على الجهاز ده.</p>
    </section>
  )
}
