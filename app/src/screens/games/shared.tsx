import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import type { GameInfo } from '../../domain/gameCatalog'
import { toArabicDigits } from '../../lib/format'
import { isMuted, setMuted } from '../../lib/gameSounds'
import { JUDGE_TEXT, useGameScale, type GameSetup, type Judgement, type Score } from './gameHooks'

/** The teacher's three buttons after the student answers aloud (keys 1, 2, 3 on a keyboard). */
export function JudgeBar({ onJudge }: { onJudge: (j: Judgement) => void }) {
  const keys: Judgement[] = ['ok', 'help', 'bad']
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).tagName
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || e.repeat) return
      const k = ['1', '2', '3', '١', '٢', '٣'].indexOf(e.key) % 3
      if (k >= 0) onJudge(keys[k])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <div className="judge-bar" role="group" aria-label="تقييم الإجابة">
      {keys.map((j) => (
        <button key={j} type="button" className={`judge judge-${j}`} onClick={() => onJudge(j)}>
          {JUDGE_TEXT[j]}
        </button>
      ))}
    </div>
  )
}

export function Progress({ i, n }: { i: number; n: number }) {
  return (
    <div className="game-progress">
      <span>
        {toArabicDigits(Math.min(i + 1, n))} من {toArabicDigits(n)}
      </span>
      <div className="day-bar" aria-hidden="true">
        <span style={{ width: `${Math.round((i / Math.max(1, n)) * 100)}%` }} />
      </div>
    </div>
  )
}

/** Page frame for a game: header, live score, sound and text size, and the way back. */
export function GameFrame({ info, setup, score, children }: { info: GameInfo; setup: GameSetup; score?: Score; children: ReactNode }) {
  const [scale, changeScale] = useGameScale()
  const [muted, setMutedState] = useState(isMuted)
  const step = setup.session
  return (
    <div className="game-screen" style={{ ['--game-scale' as string]: scale }}>
      <PageHeader
        title={`${info.icon} ${info.title}`}
        subtitle={[setup.student?.name, step && `لعبة ${toArabicDigits(step.step + 1)} من ${toArabicDigits(step.total)}`].filter(Boolean).join(' · ') || undefined}
        action={
          <Link to={`/games?${setup.query.replace(/(^|&)games=[^&]*/, '').replace(/(^|&)order=[^&]*/, '')}`} className="btn btn-ghost-light">
            الألعاب
          </Link>
        }
      />
      <div className="game-toolbar">
        {score && (
          <span className="game-score" aria-label="النتيجة لحد دلوقتي">
            <span className="gs-ok">✅ {toArabicDigits(score.ok)}</span>
            <span className="gs-help">🟡 {toArabicDigits(score.help)}</span>
            <span className="gs-bad">❌ {toArabicDigits(score.bad)}</span>
          </span>
        )}
        <span className="game-tools">
          <button
            type="button"
            className="icon-btn"
            aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            aria-pressed={muted}
            onClick={() => {
              setMuted(!muted)
              setMutedState(!muted)
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button type="button" className="icon-btn" aria-label="تصغير الخط" onClick={() => changeScale(-0.1)}>
            أ-
          </button>
          <button type="button" className="icon-btn" aria-label="تكبير الخط" onClick={() => changeScale(0.1)}>
            أ+
          </button>
        </span>
      </div>
      {children}
    </div>
  )
}

/** The end of a game: stars, the score, what to review, and where it was saved. */
export function ResultView({
  info,
  setup,
  score,
  review,
  saved,
  onAgain,
}: {
  info: GameInfo
  setup: GameSetup
  score: { ok: number; help: number; bad: number }
  review: string[]
  saved: boolean
  onAgain: () => void
}) {
  const total = score.ok + score.help + score.bad
  const ratio = total ? (score.ok + score.help * 0.5) / total : 0
  const stars = !total ? 0 : ratio >= 0.9 ? 3 : ratio >= 0.65 ? 2 : 1
  return (
    <section className="game-result card" aria-label="النتيجة">
      <p className="play-stars" aria-label={`${toArabicDigits(stars)} نجوم`}>
        {'★'.repeat(stars)}
        <span>{'★'.repeat(3 - stars)}</span>
      </p>
      <div className="result-counts">
        <span className="rc-ok">
          <b>{toArabicDigits(score.ok)}</b> صح
        </span>
        <span className="rc-help">
          <b>{toArabicDigits(score.help)}</b> بمساعدة
        </span>
        <span className="rc-bad">
          <b>{toArabicDigits(score.bad)}</b> خطأ
        </span>
      </div>
      {review.length > 0 && (
        <div className="result-review">
          <h3>محتاج مراجعة</h3>
          <p>{review.join('، ')}</p>
        </div>
      )}
      <p className="field-hint">
        {saved
          ? `اتسجلت في حصة ${setup.student?.name} النهارده، وهتظهر في تقريرها.`
          : setup.student
            ? `مفيش حصة لـ${setup.student.name} النهارده، فالنتيجة مااتسجلتش.`
            : 'اختار الطالب من صفحة الألعاب عشان النتيجة تتسجل في حصته.'}
      </p>
      <div className="play-again">
        <button type="button" className="btn btn-primary" onClick={onAgain}>
          العب تاني
        </button>
        <Link to={`/games?${setup.query}`} className="btn btn-quiet">
          لعبة تانية
        </Link>
      </div>
      <span className="sr-only">{info.title}</span>
    </section>
  )
}
