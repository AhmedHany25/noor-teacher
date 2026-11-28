import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useData, useGameContent, useGroups, useProfile, useSessions, useStudents } from '../../data/data'
import { DEFAULT_GAME_CONTENT } from '../../domain/gameDefaults'
import { findLessonTarget, noteWrite } from '../../domain/lessonTarget'
import type { GameResult } from '../../domain/notes'
import type { Student } from '../../domain/student'
import { useClock } from '../../lib/clock'
import { CHEERS, helpSound, tickSound, wrongSound, type CheerKind } from '../../lib/gameSounds'

export type Judgement = 'ok' | 'help' | 'bad'
export const JUDGE_TEXT: Record<Judgement, string> = { ok: 'صح', help: 'بمساعدة', bad: 'خطأ' }

export type Score = { ok: number; help: number; bad: number }

/** When several games are played in a row: where we are, and what to do when this game ends. */
export type SessionStep = { step: number; total: number; onDone: (score: Score, review: string[]) => void }

/** The choices made on the games screen, carried in the link: student, surahs, how many, who answers. */
export type GameSetup = { student?: Student; surahs: number[]; count: number; mode: 'judge' | 'tap'; query: string; session?: SessionStep }

export function useGameSetup(): GameSetup {
  const [params] = useSearchParams()
  const { items: students } = useStudents()
  const student = students.find((s) => s.id === params.get('student'))
  const surahs = (params.get('s') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 114)
  const count = Math.min(30, Math.max(3, Number(params.get('n')) || 10))
  const mode = params.get('mode') === 'tap' ? 'tap' : 'judge'
  return { student, surahs, count, mode, query: params.toString() }
}

/** Score kept during a game; `add` returns the totals including this answer (handy for the last one). */
export function useScore() {
  const start = { score: { ok: 0, help: 0, bad: 0 }, review: [] as string[] }
  const ref = useRef<{ score: Score; review: string[] }>(start)
  const [state, setState] = useState(start)
  const add = (j: Judgement, place?: string) => {
    const cur = ref.current
    const next = {
      score: { ...cur.score, [j]: cur.score[j] + 1 },
      review: j !== 'ok' && place && !cur.review.includes(place) ? [...cur.review, place] : cur.review,
    }
    ref.current = next
    setState(next)
    return next
  }
  return { score: state.score, review: state.review, add }
}

/**
 * Ends a game: saves it in the lesson today, then hands over to the next game when several are
 * played in a row. Returns whether it was saved.
 */
export function useFinish(info: { id: string; title: string }, setup: GameSetup) {
  const { save } = useSaveResult(setup)
  return (r: { score: Score; review: string[] }, surahs = setup.surahs): boolean => {
    const saved = save({ game: info.id, title: info.title, ...r.score, surahs, review: r.review }, !setup.session)
    setup.session?.onDone(r.score, r.review)
    return saved
  }
}

const SCALE_KEY = 'noor-games-scale'

/** Bigger or smaller text in the games (for a shared screen), remembered on this device. */
export function useGameScale(): [number, (d: number) => void] {
  const [scale, setScale] = useState(() => {
    try {
      return Number(localStorage.getItem(SCALE_KEY)) || 1
    } catch {
      return 1
    }
  })
  const change = (d: number) =>
    setScale((x) => {
      const next = Math.min(1.6, Math.max(0.8, Math.round((x + d) * 10) / 10))
      try {
        localStorage.setItem(SCALE_KEY, String(next))
      } catch {
        // remembered for this visit only
      }
      return next
    })
  return [scale, change]
}

type Burst = { kind: 'ok'; cheer: CheerKind; word: string } | { kind: 'help' | 'bad'; word: string }

const CHEER_LOOK: Record<CheerKind, { icon: string; particle: string; words: string[] }> = {
  stars: { icon: '⭐', particle: '★', words: ['أحسنت', 'رائع'] },
  hearts: { icon: '💖', particle: '♥', words: ['ما شاء الله', 'بارك الله فيك'] },
  trophy: { icon: '🏆', particle: '★', words: ['بطل', 'ممتاز'] },
  confetti: { icon: '🎉', particle: '●', words: ['هايل', 'برافو'] },
  medal: { icon: '🥇', particle: '✦', words: ['ممتاز', 'متميز'] },
  thumbs: { icon: '👍', particle: '✦', words: ['صح', 'أحسنت'] },
}
const HELP_WORDS = ['قريب، كمّل', 'شاطر، المرة الجاية لوحدك']
const BAD_WORDS = ['ولا يهمك، جرّب تاني', 'ركّز، إنت تقدر']
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

/**
 * What the student sees and hears after an answer: a different celebration for each right answer
 * (animation + tune), one steady sound and a kind word for «بمساعدة» and «خطأ».
 */
export function useFeedback(): {
  ok: () => void
  help: () => void
  bad: () => void
  judge: (j: Judgement) => void
  tick: () => void
  wrongTap: () => void
  layer: ReactNode
} {
  const [burst, setBurst] = useState<(Burst & { n: number }) | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const last = useRef<CheerKind | undefined>(undefined)
  const show = (b: Burst, ms: number) => {
    setBurst((x) => ({ ...b, n: (x?.n ?? 0) + 1 }))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setBurst(null), ms)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  function ok() {
    const kinds = (Object.keys(CHEERS) as CheerKind[]).filter((k) => k !== last.current)
    const cheer = pick(kinds)
    last.current = cheer
    CHEERS[cheer]()
    show({ kind: 'ok', cheer, word: pick(CHEER_LOOK[cheer].words) }, 1500)
  }
  function help() {
    helpSound()
    show({ kind: 'help', word: pick(HELP_WORDS) }, 1100)
  }
  function bad() {
    wrongSound()
    show({ kind: 'bad', word: pick(BAD_WORDS) }, 1100)
  }
  const judge = (j: Judgement) => (j === 'ok' ? ok() : j === 'help' ? help() : bad())
  let layer: ReactNode = null
  if (burst?.kind === 'ok') {
    const look = CHEER_LOOK[burst.cheer]
    layer = (
      <div className={`fx fx-ok fx-${burst.cheer}`} key={burst.n} aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ ['--i' as string]: i, ['--r' as string]: ((i * 37) % 100) / 100 }}>
            {look.particle}
          </i>
        ))}
        <div className="fx-big">
          <span className="fx-icon">{look.icon}</span>
          <b>{burst.word}</b>
        </div>
      </div>
    )
  } else if (burst) {
    layer = (
      <div className={`fx fx-${burst.kind}`} key={burst.n} aria-hidden="true">
        <div className="fx-big">
          <span className="fx-icon">{burst.kind === 'help' ? '💪' : '🤍'}</span>
          <b>{burst.word}</b>
        </div>
      </div>
    )
  }
  return { ok, help, bad, judge, tick: tickSound, wrongTap: wrongSound, layer }
}

/** Saves a finished game in the student's lesson today (recording them present if needed). */
export function useSaveResult(setup: GameSetup) {
  const { repos, notify } = useData()
  const { today } = useClock()
  const { items: groups } = useGroups()
  const { items: sessions } = useSessions()
  const target = useMemo(
    () => (setup.student ? findLessonTarget({ studentId: setup.student.id, groups, sessions, today, allowPast: false }) : undefined),
    [setup.student, groups, sessions, today],
  )
  function save(result: Omit<GameResult, 'at'>, announce = true): boolean {
    const st = setup.student
    if (!st || !target) return false
    const note = target.session?.notes?.[st.id] ?? {}
    const write = noteWrite(target, st.id, { ...note, games: [...(note.games ?? []), { ...result, at: Date.now() }] }, groups, Date.now())
    if (!write) return false
    if (write.kind === 'patch') repos.sessions.patch(write.id, write.fields)
    else repos.sessions.put(write.id, write.value)
    if (announce || write.recordedPresent) notify(write.recordedPresent ? `اتسجلت النتيجة واتسجل حضور ${st.name}` : 'اتسجلت النتيجة في حصة النهارده')
    return true
  }
  return { canSave: !!(setup.student && target), save }
}


/** Loads the ready-made content once (later deletions stay deleted). */
export function useSeedGameContent() {
  const { repos } = useData()
  const { profile, loading } = useProfile()
  const { items, loading: l2 } = useGameContent()
  useEffect(() => {
    if (loading || l2 || profile.gameSeeded) return
    if (!items.length) for (const x of DEFAULT_GAME_CONTENT) repos.gameContent.create(x)
    repos.profile.patch({ gameSeeded: true })
  }, [loading, l2, profile.gameSeeded, items.length, repos])
}

