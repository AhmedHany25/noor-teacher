import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { useGameContent, useSessions, useStudents } from '../../data/data'
import { useSeedGameContent } from './gameHooks'
import { ALL_GAMES, GAME_GROUPS, type GameId, type GameInfo } from '../../domain/gameCatalog'
import { surahsWith } from '../../domain/gameContent'
import { planFor } from '../../domain/games'
import { surahName } from '../../domain/quran'
import { SURAHS } from '../../domain/surahs'
import { toArabicDigits } from '../../lib/format'

const COUNTS = [3, 5, 10, 15, 20]
const SETUP_KEY = 'noor-games-setup'

function loadSetup(): string {
  try {
    return localStorage.getItem(SETUP_KEY) ?? ''
  } catch {
    return ''
  }
}

/** Route: /games — choose the student, the surahs and how many questions, then a game. */
export function GamesScreen() {
  useSeedGameContent()
  const [params, setParams] = useSearchParams()
  const { items: students } = useStudents()
  const { items: sessions } = useSessions()
  const { items: content } = useGameContent()
  const navigate = useNavigate()
  const [multi, setMulti] = useState(false)
  const [picked, setPicked] = useState<GameId[]>([])
  const [order, setOrder] = useState<'seq' | 'random'>('seq')

  // Open where the teacher left off (surahs, count, who answers) when nothing is in the link.
  useEffect(() => {
    if (params.toString()) return
    const saved = loadSetup()
    if (saved) setParams(new URLSearchParams(saved), { replace: true })
    // Only on opening the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    try {
      if (params.toString()) localStorage.setItem(SETUP_KEY, params.toString())
    } catch {
      // not remembered
    }
  }, [params])
  const studentId = params.get('student') ?? ''
  const student = students.find((s) => s.id === studentId)
  const chosen = (params.get('s') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => n >= 1 && n <= 114)
  const count = Number(params.get('n')) || 10
  const mode = params.get('mode') === 'tap' ? 'tap' : 'judge'
  const lastPassages = student ? [...new Set(planFor(student.name, sessions, student.id)?.p.map((p) => p[0]) ?? [])] : []
  // Opened for a student (from Today or a lesson) without surahs: start from their latest passages.
  const surahs = chosen.length || params.has('s') ? chosen : lastPassages

  function set(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  const setSurahs = (list: number[]) => set({ s: [...new Set(list)].sort((a, b) => a - b).join(',') || undefined })

  function chooseStudent(id: string) {
    const st = students.find((s) => s.id === id)
    const passages = st ? [...new Set(planFor(st.name, sessions, st.id)?.p.map((p) => p[0]) ?? [])] : []
    set({ student: id || undefined, s: passages.length ? passages.join(',') : params.get('s') ?? undefined })
  }

  const q = new URLSearchParams(params)
  if (surahs.length) q.set('s', surahs.join(','))
  const query = q.toString()
  const choices = students.filter((s) => s.status === 'active').sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  const readyFor = (g: GameInfo) => surahs.length > 0 && (!g.needs || surahs.some((x) => surahsWith(content, g.needs!).includes(x)))
  const togglePick = (id: GameId) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const memorisation = GAME_GROUPS[0].games
  function quickReview() {
    const ready = ALL_GAMES.filter((g) => g.id !== 'erase' && readyFor(g))
    setPicked([...ready].sort(() => Math.random() - 0.5).slice(0, 5).map((g) => g.id))
    setOrder('random')
  }
  function startSeries() {
    const q2 = new URLSearchParams(query)
    q2.set('games', picked.join(','))
    q2.set('order', order)
    navigate(`/games/series?${q2}`)
  }

  return (
    <>
      <PageHeader
        title="الألعاب"
        subtitle="ألعاب للحصة، والنتيجة بتتسجل للطالب"
        action={
          <Link to="/games/content" className="btn btn-ghost-light">
            محتوى الألعاب
          </Link>
        }
      />

      <section className="card games-setup" aria-label="إعداد اللعب">
        <label className="field">
          <span>الطالب</span>
          <select value={studentId} onChange={(e) => chooseStudent(e.target.value)}>
            <option value="">من غير طالب (النتيجة مش هتتسجل)</option>
            {choices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span>السور</span>
          <div className="surah-chips" aria-label="السور المختارة">
            {surahs.map((s) => (
              <button key={s} type="button" className="chip is-on" aria-label={`شيل سورة ${surahName(s)}`} onClick={() => setSurahs(surahs.filter((x) => x !== s))}>
                {surahName(s)} ×
              </button>
            ))}
            <select aria-label="إضافة سورة" value="" onChange={(e) => e.target.value && setSurahs([...surahs, Number(e.target.value)])}>
              <option value="">+ سورة</option>
              {SURAHS.map(([name], i) =>
                surahs.includes(i + 1) ? null : (
                  <option key={i} value={i + 1}>
                    {toArabicDigits(i + 1)}. {name}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="chip-row">
            {lastPassages.length > 0 && (
              <button type="button" className="chip" onClick={() => setSurahs(lastPassages)}>
                آخر حفظ ومراجعة
              </button>
            )}
            <button type="button" className="chip" onClick={() => setSurahs(Array.from({ length: 37 }, (_, i) => 78 + i))}>
              جزء عمّ
            </button>
            {surahs.length > 0 && (
              <button type="button" className="chip" onClick={() => setSurahs([])}>
                امسح
              </button>
            )}
          </div>
        </div>

        <div className="form-row">
          <label className="field">
            <span>عدد الأسئلة</span>
            <select value={count} onChange={(e) => set({ n: e.target.value })}>
              {COUNTS.map((c) => (
                <option key={c} value={c}>
                  {toArabicDigits(c)}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>مين بيجاوب؟</span>
            <div className="segmented">
              <button type="button" className={mode === 'judge' ? 'segment-btn is-on' : 'segment-btn'} onClick={() => set({ mode: undefined })}>
                المعلم يقيّم
              </button>
              <button type="button" className={mode === 'tap' ? 'segment-btn is-on' : 'segment-btn'} onClick={() => set({ mode: 'tap' })}>
                الطالب يختار
              </button>
            </div>
          </div>
        </div>
        {!surahs.length && <p className="field-hint">اختار سورة واحدة على الأقل عشان تبدأ.</p>}
      </section>

      <div className="games-modes">
        <div className="segmented" role="group" aria-label="طريقة اللعب">
          <button type="button" className={multi ? 'segment-btn' : 'segment-btn is-on'} onClick={() => setMulti(false)}>
            🎮 لعبة واحدة
          </button>
          <button type="button" className={multi ? 'segment-btn is-on' : 'segment-btn'} onClick={() => setMulti(true)}>
            ✅ أكتر من لعبة
          </button>
        </div>
        {multi && (
          <div className="chip-row">
            <button type="button" className="chip" onClick={() => setPicked(memorisation.filter(readyFor).map((g) => g.id))} disabled={!surahs.length}>
              كل أسئلة الحفظ
            </button>
            <button type="button" className="chip" onClick={quickReview} disabled={!surahs.length}>
              مراجعة سريعة (٥ عشوائي)
            </button>
            {picked.length > 0 && (
              <button type="button" className="chip" onClick={() => setPicked([])}>
                امسح الاختيار
              </button>
            )}
          </div>
        )}
      </div>

      {GAME_GROUPS.map((g) => (
        <section key={g.title} className="games-group" aria-label={g.title}>
          <h2 className="section-title">
            {g.title} <span className="field-hint">{g.hint}</span>
          </h2>
          <div className="games-grid">
            {g.games.map((x) => (
              <GameCard
                key={x.id}
                info={x}
                query={query}
                surahs={surahs}
                withContent={x.needs ? surahsWith(content, x.needs) : undefined}
                pick={multi ? { on: picked.includes(x.id), n: picked.indexOf(x.id) + 1, toggle: () => togglePick(x.id) } : undefined}
              />
            ))}
          </div>
        </section>
      ))}

      {multi && picked.length > 0 && (
        <div className="series-bar card" role="region" aria-label="الألعاب المختارة">
          <div className="segmented" role="group" aria-label="ترتيب الألعاب">
            <button type="button" className={order === 'seq' ? 'segment-btn is-on' : 'segment-btn'} onClick={() => setOrder('seq')}>
              بالترتيب
            </button>
            <button type="button" className={order === 'random' ? 'segment-btn is-on' : 'segment-btn'} onClick={() => setOrder('random')}>
              عشوائي
            </button>
          </div>
          <button type="button" className="btn btn-primary" onClick={startSeries}>
            {picked.length === 1 ? 'ابدأ اللعبة' : picked.length === 2 ? 'ابدأ اللعبتين' : `ابدأ ${toArabicDigits(picked.length)} ${picked.length <= 10 ? 'ألعاب' : 'لعبة'}`}
          </button>
        </div>
      )}
    </>
  )
}

function GameCard({
  info,
  query,
  surahs,
  withContent,
  pick,
}: {
  info: GameInfo
  query: string
  surahs: number[]
  withContent?: number[]
  pick?: { on: boolean; n: number; toggle: () => void }
}) {
  const covered = withContent ? surahs.filter((s) => withContent.includes(s)) : surahs
  const ready = covered.length > 0
  const note = !surahs.length
    ? 'اختار السور الأول'
    : withContent
      ? ready
        ? `شغالة على: ${covered.map(surahName).join('، ')}`
        : 'مفيش محتوى للسور دي'
      : info.choice
        ? 'المعلم يقيّم أو الطالب يختار'
        : 'المعلم يقيّم'
  const body = (
    <>
      <span className="game-icon" aria-hidden="true">
        {info.icon}
      </span>
      <span className="game-text">
        <b>{info.title}</b>
        <span>{info.hint}</span>
        <small className={ready ? '' : 'is-missing'}>{note}</small>
      </span>
    </>
  )
  if (pick) {
    return (
      <button type="button" className={`game-tile${pick.on ? ' is-picked' : ''}${ready ? '' : ' is-off'}`} aria-pressed={pick.on} disabled={!ready} onClick={pick.toggle}>
        {body}
        {pick.on && <span className="pick-n">{toArabicDigits(pick.n)}</span>}
      </button>
    )
  }
  if (!ready) {
    return withContent && surahs.length ? (
      <Link to="/games/content" className="game-tile is-off" aria-label={`${info.title}: أضف محتوى`}>
        {body}
      </Link>
    ) : (
      <div className="game-tile is-off" aria-disabled="true">
        {body}
      </div>
    )
  }
  const q = new URLSearchParams(query)
  if (withContent) q.set('s', covered.join(','))
  return (
    <Link to={`/games/${info.id}?${q}`} className="game-tile">
      {body}
    </Link>
  )
}
