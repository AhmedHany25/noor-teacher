import '@fontsource/amiri-quran/arabic-400.css'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { useData, useSessions, useStudents } from '../../data/data'
import { ayahWords, basmala, hasBasmalaHeading, type QuranText } from '../../domain/mushaf'
import { MISTAKE_TEXT, mistakeCounts, toggleWordMistake, wordMistakeCounts, type Mistake, type MistakeType } from '../../domain/notes'
import { ayahCount, surahName } from '../../domain/quran'
import { SURAHS } from '../../domain/surahs'
import { toArabicDigits } from '../../lib/format'
import { useQuran } from '../../lib/quranText'

const SIZE_KEY = 'noor-mushaf-size'
const SIZES = [1.25, 1.5, 1.75, 2, 2.4]

function storedSize(): number {
  try {
    const i = Number(localStorage.getItem(SIZE_KEY))
    return Number.isInteger(i) && i >= 0 && i < SIZES.length ? i : 2
  } catch {
    return 2
  }
}

type Picked = { s: number; a: number; w: number; text: string }

/**
 * Route: /mushaf?s=78&a=1&to=10[&student=ID][&session=ID]
 * The surah as continuous text. With a student, their earlier mistakes are coloured; with a
 * lesson too, tapping a word records a mistake in that lesson's notes.
 */
export function MushafScreen() {
  const [params, setParams] = useSearchParams()
  const { repos, notify } = useData()
  const { quran, failed } = useQuran()
  const { items: students } = useStudents()
  const { items: sessions } = useSessions()
  const [size, setSize] = useState(storedSize)
  const [picked, setPicked] = useState<Picked>()

  const s = Math.min(114, Math.max(1, Number(params.get('s')) || 1))
  const from = Number(params.get('a')) || 0
  const to = Number(params.get('to')) || from
  const studentId = params.get('student') ?? undefined
  const student = students.find((x) => x.id === studentId)
  const session = sessions.find((x) => x.id === params.get('session'))
  const editing = !!(session && student && session.attendance[student.id])
  const lessonMistakes: Mistake[] = (editing && session.notes?.[student.id]?.mistakes) || []
  const wordCounts = student ? wordMistakeCounts(sessions, student.id, session?.id) : new Map<string, number>()
  const ayahCounts = student ? mistakeCounts(sessions.filter((x) => x.id !== session?.id), student.id) : new Map<string, number>()

  useEffect(() => {
    if (!quran || !from) return
    document.getElementById(`ayah-${s}-${from}`)?.scrollIntoView?.({ block: 'center' })
  }, [quran, s, from])

  function changeSize(d: number) {
    const next = Math.min(SIZES.length - 1, Math.max(0, size + d))
    setSize(next)
    try {
      localStorage.setItem(SIZE_KEY, String(next))
    } catch {
      // size just won't be remembered
    }
  }

  function goSurah(n: number) {
    const next = new URLSearchParams(params)
    next.set('s', String(n))
    next.delete('a')
    next.delete('to')
    setParams(next, { replace: true })
    window.scrollTo?.(0, 0)
  }

  function mark(type: MistakeType) {
    if (!picked || !editing) return
    const before = lessonMistakes.find((m) => m.s === picked.s && m.a === picked.a && m.w === picked.w)
    const list = toggleWordMistake(lessonMistakes, { s: picked.s, a: picked.a, w: picked.w, type })
    const { mistakes: _old, ...rest } = session.notes?.[student.id] ?? {}
    const note = list.length ? { ...rest, mistakes: list } : rest
    repos.sessions.patch(session.id, { notes: { ...session.notes, [student.id]: note } })
    notify(before?.type === type ? 'اتشالت الغلطة' : `اتسجلت غلطة ${MISTAKE_TEXT[type]}`)
    setPicked(undefined)
  }

  const back = editing ? `/lessons/${session.groupId}/${session.date}` : student ? `/students/${student.id}` : undefined
  const current = picked && lessonMistakes.find((m) => m.s === picked.s && m.a === picked.a && m.w === picked.w)

  return (
    <div className="mushaf-screen">
      <PageHeader
        title={`سورة ${surahName(s)}`}
        subtitle={editing ? `${student.name}: دوس على الكلمة اللي غلط فيها` : student ? `أخطاء ${student.name} القديمة ملوّنة` : undefined}
        action={
          back && (
            <Link to={back} className="btn btn-ghost-light">
              {editing ? 'رجوع للحصة' : 'رجوع'}
            </Link>
          )
        }
      />

      <div className="mushaf-bar card">
        <button type="button" className="icon-btn" aria-label="السورة السابقة" disabled={s <= 1} onClick={() => goSurah(s - 1)}>
          ›
        </button>
        <select aria-label="السورة" value={s} onChange={(e) => goSurah(Number(e.target.value))}>
          {SURAHS.map(([name], i) => (
            <option key={i} value={i + 1}>
              {toArabicDigits(i + 1)}. {name}
            </option>
          ))}
        </select>
        <button type="button" className="icon-btn" aria-label="السورة التالية" disabled={s >= 114} onClick={() => goSurah(s + 1)}>
          ‹
        </button>
        <span className="mushaf-size">
          <button type="button" className="icon-btn" aria-label="تصغير الخط" disabled={size === 0} onClick={() => changeSize(-1)}>
            أ-
          </button>
          <button type="button" className="icon-btn" aria-label="تكبير الخط" disabled={size === SIZES.length - 1} onClick={() => changeSize(1)}>
            أ+
          </button>
        </span>
      </div>

      {student && (
        <p className="mushaf-legend" aria-label="دليل الألوان">
          <span className="w-c1">غلط فيها قبل كده</span>
          <span className="w-c3">اتكررت</span>
          {editing && <span className="is-marked">غلطة الحصة دي</span>}
        </p>
      )}

      {failed ? (
        <section className="empty card">
          <p>تعذّر تحميل المصحف. اتأكد من النت وافتح الصفحة تاني.</p>
        </section>
      ) : !quran ? (
        <p className="mushaf-loading" role="status">
          جارٍ تحميل المصحف…
        </p>
      ) : (
        <article className="mushaf card" style={{ fontSize: `${SIZES[size]}rem` }} aria-label={`نص سورة ${surahName(s)}`}>
          <p className="mushaf-title">سورة {surahName(s)}</p>
          {hasBasmalaHeading(s) && <p className="mushaf-basmala">{basmala(quran, s)}</p>}
          <SurahText
            quran={quran}
            s={s}
            from={from}
            to={to}
            editing={editing}
            lessonMistakes={lessonMistakes}
            wordCounts={wordCounts}
            ayahCounts={ayahCounts}
            onPick={setPicked}
          />
        </article>
      )}

      <p className="mushaf-source">
        نص المصحف من{' '}
        <a href="https://tanzil.net" target="_blank" rel="noreferrer">
          مشروع تنزيل (tanzil.net)
        </a>
      </p>

      {picked && editing && (
        <div className="mushaf-sheet card" role="dialog" aria-label="تسجيل غلطة">
          <p className="mushaf-sheet-word">{picked.text}</p>
          <p className="field-hint">
            {surahName(picked.s)} {toArabicDigits(picked.a)}
            {current ? ` · مسجلة ${MISTAKE_TEXT[current.type]}` : ''}
          </p>
          <div className="mushaf-sheet-actions">
            {(Object.keys(MISTAKE_TEXT) as MistakeType[]).map((k) => (
              <button key={k} type="button" className={current?.type === k ? 'btn btn-primary' : 'btn btn-quiet'} onClick={() => mark(k)}>
                {current?.type === k ? `شيل (${MISTAKE_TEXT[k]})` : MISTAKE_TEXT[k]}
              </button>
            ))}
          </div>
          <button type="button" className="link-btn" onClick={() => setPicked(undefined)}>
            إلغاء
          </button>
        </div>
      )}
    </div>
  )
}

function SurahText({
  quran,
  s,
  from,
  to,
  editing,
  lessonMistakes,
  wordCounts,
  ayahCounts,
  onPick,
}: {
  quran: QuranText
  s: number
  from: number
  to: number
  editing: boolean
  lessonMistakes: Mistake[]
  wordCounts: Map<string, number>
  ayahCounts: Map<string, number>
  onPick: (p: Picked) => void
}) {
  const ayahs = Array.from({ length: ayahCount(s) }, (_, i) => i + 1)
  return (
    <p className="mushaf-text">
      {ayahs.map((a) => {
        const inRange = from > 0 && a >= from && a <= to
        return (
          <span key={a} id={`ayah-${s}-${a}`} className={inRange ? 'ayah in-range' : 'ayah'}>
            {ayahWords(quran, s, a).map((w, i) => {
              const n = wordCounts.get(`${s}:${a}:${i}`) ?? 0
              const marked = lessonMistakes.find((m) => m.s === s && m.a === a && m.w === i)
              const cls = ['qw', n >= 2 ? 'w-c3' : n === 1 ? 'w-c1' : '', marked ? 'is-marked' : ''].filter(Boolean).join(' ')
              return (
                <span key={i}>
                  {editing ? (
                    <button type="button" className={cls} onClick={() => onPick({ s, a, w: i, text: w.text })}>
                      {w.text}
                    </button>
                  ) : (
                    <span className={cls}>{w.text}</span>
                  )}
                  {w.marks && <span className="q-mark">{w.marks}</span>}{' '}
                </span>
              )
            })}
            <span className={(ayahCounts.get(`${s}:${a}`) ?? 0) > 0 ? 'ayah-no has-old' : 'ayah-no'} aria-label={`آية ${toArabicDigits(a)}`}>
              ﴿{toArabicDigits(a)}﴾
            </span>{' '}
          </span>
        )
      })}
    </p>
  )
}
