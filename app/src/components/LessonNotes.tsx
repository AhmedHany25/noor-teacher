import { useState } from 'react'
import { useData } from '../data/data'
import type { Session } from '../domain/attendance'
import {
  HOMEWORK_TEXT,
  MISTAKE_TEXT,
  RATING_TEXT,
  mistakeCounts,
  previousHomework,
  suggestedStart,
  type HomeworkStatus,
  type LessonNote,
  type Mistake,
  type MistakeType,
  type Rating,
} from '../domain/notes'
import { ayahCount, surahName, validRange, type Position, type Range } from '../domain/quran'
import { SURAHS } from '../domain/surahs'
import { longDate, toArabicDigits } from '../lib/format'

type RangeDraft = { fs: string; fa: string; ts: string; ta: string; cross: boolean }

const emptyDraft: RangeDraft = { fs: '', fa: '', ts: '', ta: '', cross: false }

function draftOf(r?: Range, start?: Position): RangeDraft {
  if (r) return { fs: String(r.from.s), fa: String(r.from.a), ts: String(r.to.s), ta: String(r.to.a), cross: r.from.s !== r.to.s }
  if (start) return { ...emptyDraft, fs: String(start.s), fa: String(start.a) }
  return emptyDraft
}

/** A range from the draft, undefined if not filled in, or an error message if impossible. */
function rangeOf(d: RangeDraft): Range | undefined | string {
  if (!d.fs || !d.fa || !d.ta) return undefined
  const from = { s: Number(d.fs), a: Number(d.fa) }
  const to = { s: d.cross && d.ts ? Number(d.ts) : from.s, a: Number(d.ta) }
  const r = { from, to }
  if (validRange(r)) return r
  for (const p of [from, to]) {
    if (p.a > ayahCount(p.s)) return `${surahName(p.s)} فيها ${toArabicDigits(ayahCount(p.s))} آية.`
  }
  return 'آية النهاية لازم تكون بعد آية البداية.'
}

const SURAH_OPTIONS = SURAHS.map(([name], i) => (
  <option key={i + 1} value={i + 1}>
    {toArabicDigits(i + 1)}. {name}
  </option>
))

function RangeField({ legend, value, onChange, onRemove }: { legend: string; value: RangeDraft; onChange: (d: RangeDraft) => void; onRemove?: () => void }) {
  const set = (patch: Partial<RangeDraft>) => onChange({ ...value, ...patch })
  const max = value.fs ? ayahCount(Number(value.fs)) : undefined
  return (
    <fieldset className="range" aria-label={legend}>
      <legend>{legend}</legend>
      <div className="range-row">
        <label className="range-surah">
          <span className="sr-only">السورة</span>
          <select aria-label="السورة" value={value.fs} onChange={(e) => set({ fs: e.target.value, ts: value.cross ? value.ts : e.target.value })}>
            <option value="">اختر السورة</option>
            {SURAH_OPTIONS}
          </select>
        </label>
        <input aria-label="من آية" type="number" inputMode="numeric" min={1} max={max} placeholder="من" value={value.fa} onChange={(e) => set({ fa: e.target.value })} />
        {!value.cross && (
          <input aria-label="إلى آية" type="number" inputMode="numeric" min={1} max={max} placeholder="إلى" value={value.ta} onChange={(e) => set({ ta: e.target.value })} />
        )}
      </div>
      {value.cross ? (
        <div className="range-row">
          <select aria-label="لحد سورة" value={value.ts} onChange={(e) => set({ ts: e.target.value })}>
            <option value="">لحد سورة</option>
            {SURAH_OPTIONS}
          </select>
          <input aria-label="إلى آية" type="number" inputMode="numeric" min={1} placeholder="إلى" value={value.ta} onChange={(e) => set({ ta: e.target.value })} />
        </div>
      ) : null}
      <div className="range-links">
        <button type="button" className="link-btn" onClick={() => set({ cross: !value.cross, ts: value.fs })}>
          {value.cross ? 'نفس السورة' : 'لحد سورة تانية'}
        </button>
        {onRemove && (
          <button type="button" className="link-btn" onClick={onRemove}>
            مسح
          </button>
        )}
      </div>
    </fieldset>
  )
}

/** Notes for one student who attended: memorisation, review, rating, homework. */
export function LessonNotes({ session, student, sessions }: { session: Session; student: { id: string; name: string }; sessions: Session[] }) {
  const { repos, notify } = useData()
  const saved = session.notes?.[student.id]
  const prevHw = previousHomework(sessions, student.id, session.date)

  const [mem, setMem] = useState<RangeDraft>(() => draftOf(saved?.memorized, suggestedStart(sessions, student.id, session.date)))
  const [rev, setRev] = useState<RangeDraft | null>(() => (saved?.reviewed ? draftOf(saved.reviewed) : null))
  const [rating, setRating] = useState<Rating | undefined>(saved?.rating)
  const [hwStatus, setHwStatus] = useState<HomeworkStatus | undefined>(saved?.homeworkStatus)
  const [homework, setHomework] = useState(saved?.homework ?? '')
  const [note, setNote] = useState(saved?.note ?? '')
  const [error, setError] = useState('')
  const [mistakes, setMistakes] = useState<Mistake[]>(saved?.mistakes ?? [])
  // Mistakes on each ayah in other lessons, to flag repeats.
  const before = mistakeCounts(sessions.filter((x) => x.id !== session.id), student.id)

  function save() {
    const m = rangeOf(mem)
    const r = rev ? rangeOf(rev) : undefined
    const bad = [m, r].find((x) => typeof x === 'string')
    if (bad) {
      setError(bad as string)
      return
    }
    const next: LessonNote = {}
    if (m) next.memorized = m as Range
    if (r) next.reviewed = r as Range
    if (rating) next.rating = rating
    if (note.trim()) next.note = note.trim()
    if (homework.trim()) next.homework = homework.trim()
    if (prevHw && hwStatus) next.homeworkStatus = hwStatus
    if (mistakes.length) next.mistakes = mistakes
    setError('')
    repos.sessions.patch(session.id, { notes: { ...session.notes, [student.id]: next } })
    notify('تم حفظ الملاحظات')
  }

  return (
    <section className="lesson-section card notes" aria-label={`ملاحظات ${student.name}`}>
      <h2 className="lesson-section-title">ملاحظات {student.name}</h2>

      {prevHw && (
        <div className="prev-hw">
          <p>
            <b>الواجب السابق: {prevHw.text}</b>
            <span className="field-hint"> ({longDate(prevHw.date)})</span>
          </p>
          <div className="segmented">
            {(Object.keys(HOMEWORK_TEXT) as HomeworkStatus[]).map((k) => (
              <label key={k} className="segment">
                <input type="radio" name={`hw-${student.id}`} checked={hwStatus === k} onChange={() => setHwStatus(k)} />
                <span>{HOMEWORK_TEXT[k]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <RangeField legend="حفظ جديد" value={mem} onChange={setMem} onRemove={() => setMem(emptyDraft)} />

      {rev ? (
        <RangeField legend="مراجعة" value={rev} onChange={setRev} onRemove={() => setRev(null)} />
      ) : (
        <button type="button" className="btn btn-quiet add-review" onClick={() => setRev(emptyDraft)}>
          إضافة مراجعة
        </button>
      )}

      <MistakesField
        mistakes={mistakes}
        onChange={setMistakes}
        defaultSurah={mem.fs || (rev?.fs ?? '')}
        repeated={(m) => (before.get(`${m.s}:${m.a}`) ?? 0) > 0}
      />

      <fieldset className="field">
        <legend>التقييم</legend>
        <div className="segmented wrap">
          {(Object.keys(RATING_TEXT) as Rating[]).map((k) => (
            <label key={k} className="segment">
              <input type="radio" name={`rate-${student.id}`} checked={rating === k} onChange={() => setRating(k)} />
              <span>{RATING_TEXT[k]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor={`hw-${student.id}-next`}>الواجب للحصة الجاية</label>
        <input id={`hw-${student.id}-next`} value={homework} onChange={(e) => setHomework(e.target.value)} placeholder="مثل: حفظ النبأ ١١–٢٠ ومراجعة اللي فات" />
      </div>

      <div className="field">
        <label htmlFor={`note-${student.id}`}>ملاحظة</label>
        <textarea id={`note-${student.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={save}>
          حفظ الملاحظات
        </button>
      </div>
    </section>
  )
}

function MistakesField({
  mistakes,
  onChange,
  defaultSurah,
  repeated,
}: {
  mistakes: Mistake[]
  onChange: (m: Mistake[]) => void
  defaultSurah: string
  repeated: (m: Mistake) => boolean
}) {
  const [surah, setSurah] = useState(defaultSurah)
  const [ayah, setAyah] = useState('')
  const [type, setType] = useState<MistakeType>('hifz')
  const [error, setError] = useState('')
  const s = Number(surah || defaultSurah)

  function add() {
    const a = Number(ayah)
    if (!s || !a || a > ayahCount(s)) {
      setError(s ? `${surahName(s)} فيها ${toArabicDigits(ayahCount(s))} آية.` : 'اختر السورة والآية.')
      return
    }
    setError('')
    onChange([...mistakes, { s, a, type }])
    setAyah('')
  }

  return (
    <div className="mistakes">
      <fieldset className="range mistake-add" aria-label="إضافة خطأ">
        <legend>الأخطاء</legend>
        {mistakes.length > 0 && (
          <ul className="mistake-list" aria-label="أخطاء الحصة">
            {mistakes.map((m, i) => (
              <li key={i} className="mistake">
                <span>
                  {surahName(m.s)} {toArabicDigits(m.a)}
                </span>
                <span className="mistake-type">{MISTAKE_TEXT[m.type]}</span>
                {repeated(m) && <span className="tag tag-warn">متكررة</span>}
                <button type="button" className="link-btn" aria-label="حذف الخطأ" onClick={() => onChange(mistakes.filter((_, j) => j !== i))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
          <div className="range-row mistake-row">
          <select aria-label="سورة الخطأ" value={surah || defaultSurah} onChange={(e) => setSurah(e.target.value)}>
            <option value="">اختر السورة</option>
            {SURAH_OPTIONS}
          </select>
          <input aria-label="آية الخطأ" type="number" inputMode="numeric" min={1} placeholder="آية" value={ayah} onChange={(e) => setAyah(e.target.value)} />
        </div>
        <div className="mistake-row2">
          <div className="segmented">
            {(Object.keys(MISTAKE_TEXT) as MistakeType[]).map((k) => (
              <label key={k} className="segment">
                <input type="radio" checked={type === k} onChange={() => setType(k)} />
                <span>{MISTAKE_TEXT[k]}</span>
              </label>
            ))}
          </div>
          <button type="button" className="btn btn-quiet" onClick={add}>
            إضافة
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
      </fieldset>
    </div>
  )
}
