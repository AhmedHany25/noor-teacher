import '@fontsource/amiri-quran/arabic-400.css'
import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { useData, useGroups, useSessions, useStudents } from '../../data/data'
import { quickRecord, sessionId, type Session } from '../../domain/attendance'
import { basmala, hasBasmalaHeading, type QuranText } from '../../domain/mushaf'
import { JUZ_STARTS, SURAH_PAGE, juzOf, letterBudget, pageStarts, surahUnits, type Unit } from '../../domain/mushafPages'
import { MISTAKE_TEXT, mistakeCounts, toggleWordMistake, wordMistakeCounts, type Mistake, type MistakeType } from '../../domain/notes'
import { surahName } from '../../domain/quran'
import { occurrencesOn } from '../../domain/schedule'
import { SURAHS } from '../../domain/surahs'
import { useClock } from '../../lib/clock'
import { toArabicDigits } from '../../lib/format'
import { useQuran } from '../../lib/quranText'

const SIZES = [20, 23, 26, 30, 34, 40] // px
const PREFS_KEY = 'noor-mushaf'

type Prefs = { size: number; brush: MistakeType; s: number; a: number }

function loadPrefs(): Prefs {
  const fallback: Prefs = { size: window.innerWidth < 520 ? 1 : 2, brush: 'hifz', s: 1, a: 1 }
  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>) }
  } catch {
    return fallback
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    // remembered for this visit only
  }
}

/** Width of the page box, following resizes. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      if (el.clientWidth) setWidth(el.clientWidth)
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

/**
 * Route: /mushaf?s=78&a=1&to=10[&student=ID][&session=ID]
 * One page at a time, so it stays fast during a lesson. With a student whose lesson today is
 * recorded, one tap on a word records a mistake of the chosen kind in that lesson's notes.
 */
export function MushafScreen() {
  const [params, setParams] = useSearchParams()
  const { repos } = useData()
  const { today } = useClock()
  const { quran, failed } = useQuran()
  const { items: students } = useStudents()
  const { items: groups } = useGroups()
  const { items: sessions } = useSessions()
  const [prefs, setPrefsState] = useState(loadPrefs)
  const setPrefs = (patch: Partial<Prefs>) =>
    setPrefsState((p) => {
      const next = { ...p, ...patch }
      savePrefs(next)
      return next
    })

  const hasS = !!params.get('s')
  const s = Math.min(114, Math.max(1, Number(params.get('s')) || prefs.s))
  const atEnd = params.get('a') === 'last'
  const from = Number(params.get('a')) || (hasS ? 0 : prefs.a)
  const to = Number(params.get('to')) || 0
  const studentId = params.get('student') ?? ''
  const student = students.find((x) => x.id === studentId)

  // Where mistakes go: the lesson in the link, else the student's lesson today.
  const session: Session | undefined =
    sessions.find((x) => x.id === params.get('session')) ??
    (student ? sessions.find((x) => x.date === today && x.attendance[student.id]?.status === 'p') : undefined)
  const marking = !!(student && session?.attendance[student.id]?.status === 'p')
  // A lesson today for this student alone, not recorded yet: offer to record it present.
  const pending = useMemo(() => {
    if (!student || marking) return undefined
    const o = occurrencesOn(groups, today).find((x) => {
      const g = groups.find((y) => y.id === x.groupId)
      return !x.cancelledBy && g?.studentIds.length === 1 && g.studentIds[0] === student.id
    })
    return o && !sessions.some((x) => x.id === sessionId(o.groupId, o.date)) ? o : undefined
  }, [student, marking, groups, sessions, today])

  const lessonMistakes: Mistake[] = useMemo(
    () => (marking && student ? (session?.notes?.[student.id]?.mistakes ?? []) : []),
    [marking, student, session],
  )
  const wordCounts = useMemo(
    () => (student ? wordMistakeCounts(sessions, student.id, session?.id) : new Map<string, number>()),
    [sessions, student, session],
  )
  const ayahCounts = useMemo(
    () => (student ? mistakeCounts(sessions.filter((x) => x.id !== session?.id), student.id) : new Map<string, number>()),
    [sessions, student, session],
  )

  function setParam(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  function tapWord(a: number, w: number) {
    if (!marking || !student || !session) return
    const list = toggleWordMistake(lessonMistakes, { s, a, w, type: prefs.brush })
    const { mistakes: _old, ...rest } = session.notes?.[student.id] ?? {}
    repos.sessions.patch(session.id, { notes: { ...session.notes, [student.id]: list.length ? { ...rest, mistakes: list } : rest } })
  }

  function startLesson() {
    if (!pending) return
    const g = groups.find((x) => x.id === pending.groupId)!
    repos.sessions.put(sessionId(pending.groupId, pending.date), quickRecord(pending, g, 'p', undefined, Date.now()))
  }

  const back = marking && session ? `/lessons/${session.groupId}/${session.date}` : undefined
  const choices = students.filter((x) => x.status === 'active' || x.id === studentId).sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  return (
    <div className="mushaf-screen">
      <PageHeader
        title="المصحف"
        subtitle={marking ? `${student!.name}: دوسة على الكلمة = غلطة ${MISTAKE_TEXT[prefs.brush]}` : student ? `أخطاء ${student.name} القديمة ملوّنة` : undefined}
        action={
          back && (
            <Link to={back} className="btn btn-ghost-light">
              رجوع للحصة
            </Link>
          )
        }
      />

      <div className="mushaf-bar card">
        <select aria-label="السورة" value={s} onChange={(e) => setParam({ s: e.target.value, a: undefined, to: undefined })}>
          {SURAHS.map(([name], i) => (
            <option key={i} value={i + 1}>
              {toArabicDigits(i + 1)}. {name}
            </option>
          ))}
        </select>
        <select
          aria-label="الانتقال إلى جزء"
          value=""
          onChange={(e) => {
            const j = JUZ_STARTS[Number(e.target.value) - 1]
            if (j) setParam({ s: String(j[0]), a: String(j[1]), to: undefined })
          }}
        >
          <option value="">جزء…</option>
          {JUZ_STARTS.map(([js, ja], i) => (
            <option key={i} value={i + 1}>
              الجزء {toArabicDigits(i + 1)}: {surahName(js)} {toArabicDigits(ja)}
            </option>
          ))}
        </select>
        <select aria-label="الطالب" value={studentId} onChange={(e) => setParam({ student: e.target.value || undefined, session: undefined })}>
          <option value="">من غير طالب</option>
          {choices.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <span className="mushaf-size">
          <button type="button" className="icon-btn" aria-label="تصغير الخط" disabled={prefs.size === 0} onClick={() => setPrefs({ size: prefs.size - 1 })}>
            أ-
          </button>
          <button type="button" className="icon-btn" aria-label="تكبير الخط" disabled={prefs.size === SIZES.length - 1} onClick={() => setPrefs({ size: prefs.size + 1 })}>
            أ+
          </button>
        </span>
      </div>

      {marking ? (
        <div className="mushaf-brush card" role="radiogroup" aria-label="نوع الغلطة">
          {(Object.keys(MISTAKE_TEXT) as MistakeType[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={prefs.brush === k} className={`brush mk-${k}`} onClick={() => setPrefs({ brush: k })}>
              {MISTAKE_TEXT[k]}
            </button>
          ))}
          <span className="brush-count">
            غلطات الحصة: <b>{toArabicDigits(lessonMistakes.length)}</b>
          </span>
        </div>
      ) : pending ? (
        <div className="mushaf-brush card">
          <span>حصة {student!.name} النهارده لسه متسجلتش.</span>
          <button type="button" className="btn btn-primary" onClick={startLesson}>
            سجّله حاضر وابدأ تعليم الأخطاء
          </button>
        </div>
      ) : student ? (
        <p className="field-hint mushaf-note">لتسجيل الأخطاء، سجّل حضور {student.name} في حصة النهارده الأول.</p>
      ) : null}

      {failed ? (
        <section className="empty card">
          <p>تعذّر تحميل المصحف. اتأكد من النت وافتح الصفحة تاني.</p>
        </section>
      ) : !quran ? (
        <p className="mushaf-loading" role="status">
          جارٍ تحميل المصحف…
        </p>
      ) : (
        <Pages
          key={`${s}-${from}-${atEnd}`}
          quran={quran}
          s={s}
          from={from}
          to={to}
          atEnd={atEnd}
          fontPx={SIZES[prefs.size]}
          marking={marking}
          lessonMistakes={lessonMistakes}
          wordCounts={wordCounts}
          ayahCounts={ayahCounts}
          onTap={tapWord}
          onSurah={(n, last) => setParam({ s: String(n), a: last ? 'last' : undefined, to: undefined })}
          onSeen={(a) => {
            if (prefs.s !== s || prefs.a !== a) setPrefs({ s, a })
          }}
        />
      )}

      <p className="mushaf-source">
        نص المصحف من{' '}
        <a href="https://tanzil.net" target="_blank" rel="noreferrer">
          مشروع تنزيل (tanzil.net)
        </a>
      </p>
    </div>
  )
}

function Pages({
  quran,
  s,
  from,
  to,
  atEnd,
  fontPx,
  marking,
  lessonMistakes,
  wordCounts,
  ayahCounts,
  onTap,
  onSurah,
  onSeen,
}: {
  quran: QuranText
  s: number
  from: number
  to: number
  atEnd: boolean
  fontPx: number
  marking: boolean
  lessonMistakes: Mistake[]
  wordCounts: Map<string, number>
  ayahCounts: Map<string, number>
  onTap: (a: number, w: number) => void
  onSurah: (s: number, last: boolean) => void
  onSeen: (a: number) => void
}) {
  const { ref, width } = useWidth()
  const units = useMemo(() => surahUnits(quran, s), [quran, s])
  const lines = Math.min(15, Math.max(6, Math.floor((window.innerHeight * 0.62) / (fontPx * 2.3))))
  const starts = useMemo(() => pageStarts(units, letterBudget(width - 32, fontPx, lines)), [units, width, fontPx, lines])
  // The first word on screen; pages are recomputed around it when the font or width changes.
  const [anchor, setAnchor] = useState(() => (atEnd ? units.length - 1 : from > 0 ? Math.max(0, units.findIndex((u) => u.a === from)) : 0))
  let page = 0
  while (page + 1 < starts.length && starts[page + 1] <= anchor) page++
  const total = starts.length
  const end = starts[page + 1] ?? units.length
  const first = units[starts[page]]
  const touch = useRef<{ x: number; y: number }>(undefined)
  const firstA = first?.a ?? 1

  useEffect(() => {
    onSeen(firstA)
    // Only when the page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstA])

  function go(p: number) {
    if (p < 0) {
      if (s > 1) onSurah(s - 1, true)
    } else if (p >= total) {
      if (s < 114) onSurah(s + 1, false)
    } else setAnchor(starts[p])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName
      if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') go(page + 1)
      else if (e.key === 'ArrowRight') go(page - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function onTouchStart(e: TouchEvent) {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchEnd(e: TouchEvent) {
    const t = touch.current
    if (!t) return
    const dx = e.changedTouches[0].clientX - t.x
    const dy = e.changedTouches[0].clientY - t.y
    // Arabic book: swiping to the right turns to the next page.
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx > 0 ? page + 1 : page - 1)
  }

  const lastA = units[end - 1]?.a ?? 1
  return (
    <>
      <div className="mushaf-frame" ref={ref}>
        <article
          className={marking ? 'mushaf-page is-marking' : 'mushaf-page'}
          style={{ fontSize: `${fontPx}px` }}
          aria-label={`نص سورة ${surahName(s)}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="mushaf-top">
            <span>سورة {surahName(s)}</span>
            <span>الجزء {toArabicDigits(juzOf(s, firstA))}</span>
          </div>
          {page === 0 && (
            <div className="mushaf-head">
              <p className="mushaf-title">سورة {surahName(s)}</p>
              {hasBasmalaHeading(s) && <p className="mushaf-basmala">{basmala(quran, s)}</p>}
            </div>
          )}
          <p className="mushaf-text">
            {units.slice(starts[page], end).map((u) => (
              <UnitView
                key={'end' in u ? `e${u.a}` : `${u.a}:${u.w}`}
                u={u}
                s={s}
                inRange={from > 0 && u.a >= from && u.a <= (to || from)}
                marking={marking}
                marked={'end' in u ? undefined : lessonMistakes.find((m) => m.s === s && m.a === u.a && m.w === u.w)}
                count={'end' in u ? (ayahCounts.get(`${s}:${u.a}`) ?? 0) : (wordCounts.get(`${s}:${u.a}:${u.w}`) ?? 0)}
                onTap={onTap}
              />
            ))}
          </p>
          <div className="mushaf-foot">
            <span className="mushaf-pnum">{toArabicDigits(page + 1)}</span>
          </div>
        </article>
      </div>

      <div className="mushaf-nav">
        <button type="button" className="btn btn-quiet" onClick={() => go(page - 1)} disabled={page === 0 && s === 1}>
          {page === 0 && s > 1 ? '› السورة السابقة' : '› السابقة'}
        </button>
        <input type="range" aria-label="رقم الصفحة" min={1} max={total} value={page + 1} disabled={total < 2} onChange={(e) => go(Number(e.target.value) - 1)} />
        <button type="button" className="btn btn-primary" onClick={() => go(page + 1)} disabled={page === total - 1 && s === 114}>
          {page === total - 1 && s < 114 ? 'السورة التالية ‹' : 'التالية ‹'}
        </button>
      </div>
      <p className="mushaf-info">
        صفحة {toArabicDigits(page + 1)} من {toArabicDigits(total)} · الآيات {toArabicDigits(firstA)}–{toArabicDigits(lastA)} · السورة في صفحة{' '}
        {toArabicDigits(SURAH_PAGE[s - 1])} من مصحف المدينة
      </p>
    </>
  )
}

function UnitView({
  u,
  s,
  inRange,
  marking,
  marked,
  count,
  onTap,
}: {
  u: Unit
  s: number
  inRange: boolean
  marking: boolean
  marked?: Mistake
  count: number
  onTap: (a: number, w: number) => void
}) {
  if ('end' in u) {
    return (
      <>
        <span className={count > 0 ? 'ayah-no has-old' : 'ayah-no'} id={`ayah-${s}-${u.a}`} aria-label={`آية ${toArabicDigits(u.a)}`}>
          {toArabicDigits(u.a)}
        </span>{' '}
      </>
    )
  }
  const cls = ['qw', count >= 2 ? 'w-c3' : count === 1 ? 'w-c1' : '', marked ? `is-marked mk-${marked.type}` : '', inRange ? 'in-range' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <>
      {marking ? (
        <button type="button" className={cls} onClick={() => onTap(u.a, u.w)} aria-pressed={!!marked}>
          {u.word.text}
        </button>
      ) : (
        <span className={cls}>{u.word.text}</span>
      )}
      {u.word.marks && <span className="q-mark">{u.word.marks}</span>}{' '}
    </>
  )
}
