import '@fontsource/amiri-quran/arabic-400.css'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { useGameContent } from '../../data/data'
import { gameInfo, type GameInfo } from '../../domain/gameCatalog'
import type { GameContent } from '../../domain/gameContent'
import type { QuranText } from '../../domain/mushaf'
import { toArabicDigits } from '../../lib/format'
import { useQuran } from '../../lib/quranText'
import { MatchGame, PicGame, SituationGame } from './ContentGames'
import { useGameSetup, type GameSetup, type Score } from './gameHooks'
import { QuizGame } from './QuizGame'
import { EraseGame, OrderGame } from './VerseGames'

function GameView({ info, setup, quran, content }: { info: GameInfo; setup: GameSetup; quran: QuranText; content: GameContent[] }) {
  switch (info.id) {
    case 'order':
      return <OrderGame info={info} setup={setup} quran={quran} />
    case 'erase':
      return <EraseGame info={info} setup={setup} quran={quran} />
    case 'pic':
      return <PicGame info={info} setup={setup} content={content} />
    case 'match':
      return <MatchGame info={info} setup={setup} content={content} />
    case 'situation':
      return <SituationGame info={info} setup={setup} quran={quran} content={content} />
    default:
      return <QuizGame info={info} setup={setup} quran={quran} />
  }
}

function Loading({ failed }: { failed: boolean }) {
  return failed ? (
    <p className="empty card">تعذّر تحميل المصحف. اتأكد من النت وافتح الصفحة تاني.</p>
  ) : (
    <p className="mushaf-loading" role="status">
      جارٍ التحميل…
    </p>
  )
}

/** Route: /games/:game?student=&s=78,79&n=10&mode=judge|tap */
export function GamePlayScreen() {
  const { game = '' } = useParams()
  const info = gameInfo(game)
  const setup = useGameSetup()
  const { quran, failed } = useQuran()
  const { items: content, loading } = useGameContent()

  if (!info) {
    return (
      <section className="empty card">
        <p>
          اللعبة دي مش موجودة. <Link to="/games">ارجع للألعاب</Link>
        </p>
      </section>
    )
  }
  if (!quran || loading) return <Loading failed={failed} />
  return <GameView key={`${info.id}?${setup.query}`} info={info} setup={setup} quran={quran} content={content} />
}

type Played = { info: GameInfo; score: Score; review: string[] }

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

/** Route: /games/series?games=next,mcv,order&order=random|seq&… — several games in a row, then one summary. */
export function GameSeriesScreen() {
  const [params] = useSearchParams()
  const base = useGameSetup()
  const { quran, failed } = useQuran()
  const { items: content, loading } = useGameContent()
  const gamesParam = params.get('games') ?? ''
  const random = params.get('order') === 'random'
  const [round, setRound] = useState(0)
  const order = useMemo(() => {
    const chosen = gamesParam
      .split(',')
      .map(gameInfo)
      .filter((g): g is GameInfo => !!g)
    return random ? shuffle(chosen) : chosen
    // A new shuffle for each round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, gamesParam, random])
  const [step, setStep] = useState(0)
  const [played, setPlayed] = useState<Played[]>([])

  const current = order[step]
  const session = useMemo(
    () =>
      current && {
        step,
        total: order.length,
        onDone: (score: Score, review: string[]) => {
          setPlayed((p) => (p.length > step ? p : [...p, { info: current, score, review }]))
          setStep((s) => (s === step ? s + 1 : s))
        },
      },
    [current, step, order.length],
  )

  if (!order.length) {
    return (
      <section className="empty card">
        <p>
          مفيش ألعاب مختارة. <Link to="/games">ارجع للألعاب</Link>
        </p>
      </section>
    )
  }
  if (!quran || loading) return <Loading failed={failed} />
  if (current && session) {
    return <GameView key={`${round}-${step}`} info={current} setup={{ ...base, session }} quran={quran} content={content} />
  }

  const total = played.reduce((t, p) => ({ ok: t.ok + p.score.ok, help: t.help + p.score.help, bad: t.bad + p.score.bad }), { ok: 0, help: 0, bad: 0 })
  const answers = total.ok + total.help + total.bad
  const ratio = answers ? (total.ok + total.help * 0.5) / answers : 0
  const stars = !answers ? 0 : ratio >= 0.9 ? 3 : ratio >= 0.65 ? 2 : 1
  const review = [...new Set(played.flatMap((p) => p.review))]
  const back = `/games?${base.query.replace(/(^|&)(games|order)=[^&]*/g, '')}`
  return (
    <>
      <PageHeader title="نتيجة الألعاب" subtitle={base.student?.name} />
      <section className="game-result card" aria-label="النتيجة">
        <p className="play-stars" aria-label={`${toArabicDigits(stars)} نجوم`}>
          {'★'.repeat(stars)}
          <span>{'★'.repeat(3 - stars)}</span>
        </p>
        <div className="result-counts">
          <span className="rc-ok">
            <b>{toArabicDigits(total.ok)}</b> صح
          </span>
          <span className="rc-help">
            <b>{toArabicDigits(total.help)}</b> بمساعدة
          </span>
          <span className="rc-bad">
            <b>{toArabicDigits(total.bad)}</b> خطأ
          </span>
        </div>
        <table className="report-table series-table" aria-label="كل لعبة">
          <thead>
            <tr>
              <th>اللعبة</th>
              <th>صح</th>
              <th>بمساعدة</th>
              <th>خطأ</th>
            </tr>
          </thead>
          <tbody>
            {played.map((p, i) => (
              <tr key={i}>
                <td>
                  {p.info.icon} {p.info.title}
                </td>
                <td>{toArabicDigits(p.score.ok)}</td>
                <td>{toArabicDigits(p.score.help)}</td>
                <td>{toArabicDigits(p.score.bad)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {review.length > 0 && (
          <div className="result-review">
            <h3>محتاج مراجعة</h3>
            <p>{review.join('، ')}</p>
          </div>
        )}
        <p className="field-hint">
          {base.student ? `كل لعبة اتسجلت لوحدها في حصة ${base.student.name} النهارده لو عنده حصة.` : 'اختار الطالب من صفحة الألعاب عشان النتايج تتسجل.'}
        </p>
        <div className="play-again">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setPlayed([])
              setStep(0)
              setRound((r) => r + 1)
            }}
          >
            العب تاني
          </button>
          <Link to={back} className="btn btn-quiet">
            الألعاب
          </Link>
        </div>
      </section>
    </>
  )
}
