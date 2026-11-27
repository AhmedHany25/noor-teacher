import { useState } from 'react'
import { useData, useDevices, useProfile } from '../../data/data'
import { DEFAULT_NOTIFY, type NotifySettings } from '../../domain/reminders'
import { time12 } from '../../domain/schedule'
import { toArabicDigits } from '../../lib/format'

/** Device access is injected so the screen can be tested without a real browser push stack. */
export type PushApi = {
  supported: () => boolean
  enable: () => Promise<string>
  test: () => Promise<void>
  label: () => string
}

const TOKEN_KEY = 'noor-push-token'

function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function NotificationsSection({ push }: { push: PushApi }) {
  const { repos, notify } = useData()
  const { profile } = useProfile()
  const { items: devices } = useDevices()
  const settings: NotifySettings = { ...DEFAULT_NOTIFY, ...profile.notify }
  const [token, setToken] = useState(storedToken)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const thisDevice = token ? devices.find((d) => d.id === token) : undefined

  const set = (patch: Partial<NotifySettings>) => repos.profile.patch({ notify: { ...settings, ...patch } })

  async function enable() {
    setBusy(true)
    setError('')
    try {
      const t = await push.enable()
      repos.devices.put(t, { token: t, label: push.label(), createdAt: Date.now() })
      try {
        localStorage.setItem(TOKEN_KEY, t)
      } catch {
        // Status just won't be remembered on this device.
      }
      setToken(t)
      if (!profile.notify) repos.profile.patch({ notify: settings })
      notify('اتفعّلت الإشعارات على الجهاز ده')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تفعيل الإشعارات.')
    } finally {
      setBusy(false)
    }
  }

  function disable() {
    if (token) repos.devices.remove(token)
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // ignore
    }
    setToken(null)
    notify('اتقفلت الإشعارات على الجهاز ده')
  }

  return (
    <section className="settings-block" aria-label="الإشعارات">
      <h2 className="section-title">الإشعارات</h2>

      {!push.supported() ? (
        <p className="field-hint settings-hint">المتصفح ده مش بيدعم الإشعارات. جرّب Chrome على الموبايل بعد ما تضيف التطبيق للشاشة الرئيسية.</p>
      ) : thisDevice ? (
        <div className="notify-status">
          <span className="tag tag-sent">مفعّلة على الجهاز ده ({thisDevice.label})</span>
          <button type="button" className="link-btn" onClick={() => void push.test()}>
            تجربة
          </button>
          <button type="button" className="link-btn" onClick={disable}>
            قفلها هنا
          </button>
        </div>
      ) : (
        <>
          <p className="field-hint settings-hint">فعّلها على كل جهاز عايز التذكيرات توصله، حتى والتطبيق مقفول.</p>
          <button type="button" className="btn btn-primary" onClick={() => void enable()} disabled={busy}>
            {busy ? 'جارٍ التفعيل…' : 'تفعيل الإشعارات على الجهاز ده'}
          </button>
        </>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="notify-rules">
        <label className="check">
          <input type="checkbox" checked={settings.beforeOn} onChange={(e) => set({ beforeOn: e.target.checked })} />
          <span>تذكير قبل كل حصة</span>
        </label>
        {settings.beforeOn && (
          <select aria-label="قبل الحصة بـ" value={settings.beforeMinutes} onChange={(e) => set({ beforeMinutes: Number(e.target.value) })}>
            {[5, 10, 15, 30, 60].map((m) => (
              <option key={m} value={m}>
                قبلها بـ {toArabicDigits(m)} دقيقة
              </option>
            ))}
          </select>
        )}

        <label className="check">
          <input type="checkbox" checked={settings.eodOn} onChange={(e) => set({ eodOn: e.target.checked })} />
          <span>تنبيه آخر اليوم بالحصص اللي متسجلتش</span>
        </label>
        {settings.eodOn && (
          <input type="time" aria-label="وقت تنبيه آخر اليوم" value={settings.eodTime} onChange={(e) => e.target.value && set({ eodTime: e.target.value })} />
        )}

        <label className="check">
          <input type="checkbox" checked={settings.morningOn} onChange={(e) => set({ morningOn: e.target.checked })} />
          <span>ملخص الصبح بحصص اليوم</span>
        </label>
        {settings.morningOn && (
          <input type="time" aria-label="وقت ملخص الصبح" value={settings.morningTime} onChange={(e) => e.target.value && set({ morningTime: e.target.value })} />
        )}
      </div>
      <p className="field-hint settings-hint">
        المواعيد بتوقيت مصر، والتذكير ممكن يتأخر دقايق قليلة.{' '}
        {settings.eodOn && `تنبيه آخر اليوم الساعة ${time12(settings.eodTime)}.`}
      </p>
    </section>
  )
}
