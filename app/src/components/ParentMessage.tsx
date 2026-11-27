import { useState } from 'react'
import { useData } from '../data/data'
import type { Session } from '../domain/attendance'
import { DEFAULT_TIME_ZONE } from '../domain/countries'
import { parentMessage } from '../domain/message'
import { whatsappNumber, type Student } from '../domain/student'
import { longDate, toArabicDigits } from '../lib/format'

const sentAt = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' })

/** The parent's WhatsApp message for one student in one lesson: editable, then sent with one tap. */
export function ParentMessage({ session, student }: { session: Session; student: Pick<Student, 'id' | 'name' | 'guardianPhone' | 'timeZone'> }) {
  const { repos } = useData()
  const status = session.attendance[student.id]?.status ?? 'p'
  const generated = parentMessage({ name: student.name, dateText: longDate(session.date), status, note: session.notes?.[student.id] })
  // Follow the saved notes until the teacher edits the text by hand.
  const [custom, setCustom] = useState<string | null>(null)
  const text = custom ?? generated
  const phone = student.guardianPhone ? whatsappNumber(student.guardianPhone, student.timeZone, DEFAULT_TIME_ZONE) : null
  const href = `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`
  const sent = session.sent?.[student.id]

  function markSent() {
    repos.sessions.patch(session.id, { sent: { ...session.sent, [student.id]: Date.now() } })
  }

  return (
    <section className="lesson-section card message" aria-label={`رسالة ولي أمر ${student.name}`}>
      <div className="message-head">
        <h2 className="lesson-section-title">رسالة ولي أمر {student.name}</h2>
        {sent && <span className="tag tag-sent">اتبعت ✓ {toArabicDigits(sentAt.format(new Date(sent)))}</span>}
      </div>
      <label className="sr-only" htmlFor={`msg-${student.id}`}>
        نص الرسالة
      </label>
      <textarea id={`msg-${student.id}`} className="message-text" rows={8} value={text} onChange={(e) => setCustom(e.target.value)} />
      {custom !== null && (
        <button type="button" className="link-btn message-reset" onClick={() => setCustom(null)}>
          رجّع النص من الملاحظات
        </button>
      )}
      {!phone && <p className="field-hint">مفيش رقم واتساب لولي الأمر. هتختار المحادثة بنفسك، أو ضيف الرقم من بيانات الطالب.</p>}
      <div className="form-actions">
        <a href={href} target="_blank" rel="noreferrer" className="btn btn-primary btn-wa-send" onClick={markSent}>
          إرسال على واتساب
        </a>
        <button type="button" className="btn btn-quiet" onClick={() => void navigator.clipboard?.writeText(text)}>
          نسخ
        </button>
      </div>
    </section>
  )
}
