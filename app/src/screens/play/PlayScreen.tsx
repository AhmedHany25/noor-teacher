import '@fontsource/amiri-quran/arabic-400.css'
import { useState } from 'react'
import { useLocation } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { completeQuestions, decodePlan, orderRounds, stars, type CompleteQuestion, type GamePlan, type OrderRound } from '../../domain/games'
import { surahName } from '../../domain/quran'
import { toArabicDigits } from '../../lib/format'
import { useQuran } from '../../lib/quranText'

type Game = 'complete' | 'order'
const GAME_NAME: Record<Game, string> = { complete: 'كمّل الآية', order: 'رتّب الكلمات' }

type Result = { game: Game; correct: number; total: number }

/** Route: /play#<plan> — the student's games. Public: no sign-in, no data beyond the link. */
export function PlayScreen() {
  const { hash } = useLocation()
  const plan = decodePlan(hash.replace(/^#/, ''))
  const { quran, failed } = useQuran()
  const [game, setGame] = useState<{ kind: Game; complete?: CompleteQuestion[]; order?: OrderRound[] }>()
  const [result, setResult] = useState<Result>()

  function start(kind: Game) {
    if (!quran || !plan) return
    setResult(undefined)
    setGame(kind === 'complete' ? { kind, complete: completeQuestions(quran, plan, Math.random) } : { kind, order: orderRounds(quran, plan, Math.random) })
  }

  function finish(r: Result) {
    setGame(undefined)
    setResult(r)
  }

  return (
    <div className="shell-main play">
      <PageHeader title="ألعاب نور القرآن" subtitle={plan ? `أهلًا يا ${plan.n}` : undefined} />
      <main className="play-body">
        {!plan ? (
          <section className="empty card">
            <p>اللينك ده مش شغال. اطلب من الشيخ يبعتلك لينك جديد.</p>
          </section>
        ) : failed ? (
          <section className="empty card">
            <p>تعذّر تحميل الآيات. اتأكد من النت وافتح اللينك تاني.</p>
          </section>
        ) : !quran ? (
          <p className="mushaf-loading" role="status">
            جارٍ التحميل…
          </p>
        ) : result ? (
          <ResultCard plan={plan} result={result} onAgain={() => start(result.game)} onOther={() => start(result.game === 'complete' ? 'order' : 'complete')} />
        ) : game?.complete ? (
          <CompleteGame questions={game.complete} onDone={(correct) => finish({ game: 'complete', correct, total: game.complete!.length })} />
        ) : game?.order ? (
          <OrderGame rounds={game.order} onDone={(correct) => finish({ game: 'order', correct, total: game.order!.length })} />
        ) : (
          <Menu plan={plan} onStart={start} />
        )}
      </main>
    </div>
  )
}

function Menu({ plan, onStart }: { plan: GamePlan; onStart: (g: Game) => void }) {
  return (
    <>
      <p className="play-from">
        من {plan.p.map(([s, f, t]) => `${surahName(s)} ${toArabicDigits(f)}–${toArabicDigits(t)}`).join('، ')}
      </p>
      <div className="play-menu">
        <button type="button" className="play-card card" onClick={() => onStart('complete')}>
          <b>كمّل الآية</b>
          <span>هيظهرلك أول الآية، واختار تكملتها الصح.</span>
        </button>
        <button type="button" className="play-card card" onClick={() => onStart('order')}>
          <b>رتّب الكلمات</b>
          <span>كلمات الآية متلخبطة، دوس عليها بالترتيب.</span>
        </button>
      </div>
    </>
  )
}

function Progress({ i, n, label }: { i: number; n: number; label: string }) {
  return (
    <div className="play-progress">
      <span>
        {label} {toArabicDigits(i + 1)} من {toArabicDigits(n)}
      </span>
      <div className="day-bar" aria-hidden="true">
        <span style={{ width: `${Math.round((i / n) * 100)}%` }} />
      </div>
    </div>
  )
}

function CompleteGame({ questions, onDone }: { questions: CompleteQuestion[]; onDone: (correct: number) => void }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string>()
  const [correct, setCorrect] = useState(0)
  const x = questions[i]
  if (!x) return <p className="empty card">مفيش آيات كفاية للعبة دي.</p>

  function pick(o: string) {
    if (picked) return
    setPicked(o)
    if (o === x.answer) setCorrect((n) => n + 1)
  }

  function next() {
    if (i + 1 >= questions.length) onDone(correct)
    else {
      setI(i + 1)
      setPicked(undefined)
    }
  }

  return (
    <section className="play-game card" aria-label="كمّل الآية">
      <Progress i={i} n={questions.length} label="سؤال" />
      <p className="play-ask">{x.asks === 'rest' ? 'كمّل الآية:' : 'إيه الآية اللي بعدها؟'}</p>
      <p className="play-prompt">
        {x.prompt}
        {x.asks === 'rest' ? ' …' : ''}
      </p>
      <div className="play-options">
        {x.options.map((o) => {
          const state = !picked ? '' : o === x.answer ? ' is-right' : o === picked ? ' is-wrong' : ''
          return (
            <button key={o} type="button" className={`play-option${state}`} onClick={() => pick(o)} disabled={!!picked && !state}>
              {o}
            </button>
          )
        })}
      </div>
      {picked && (
        <div className="play-feedback" role="status">
          <b>{picked === x.answer ? 'صح، برافو!' : 'لأ، الصح متعلّم عليه بالأخضر'}</b>
          <button type="button" className="btn btn-primary" onClick={next}>
            {i + 1 >= questions.length ? 'النتيجة' : 'التالي'}
          </button>
        </div>
      )}
    </section>
  )
}

function OrderGame({ rounds, onDone }: { rounds: OrderRound[]; onDone: (correct: number) => void }) {
  const [i, setI] = useState(0)
  const [placed, setPlaced] = useState<number[]>([]) // indexes into `shuffled`
  const [wrong, setWrong] = useState(0)
  const [shake, setShake] = useState<number>()
  const [perfect, setPerfect] = useState(0)
  const r = rounds[i]
  if (!r) return <p className="empty card">مفيش آيات كفاية للعبة دي.</p>
  const done = placed.length === r.words.length

  function tap(k: number) {
    if (done || placed.includes(k)) return
    if (r.shuffled[k] === r.words[placed.length]) {
      const next = [...placed, k]
      setPlaced(next)
      setShake(undefined)
      if (next.length === r.words.length && wrong === 0) setPerfect((n) => n + 1)
    } else {
      setWrong((n) => n + 1)
      setShake(k)
    }
  }

  function next() {
    if (i + 1 >= rounds.length) onDone(perfect)
    else {
      setI(i + 1)
      setPlaced([])
      setWrong(0)
      setShake(undefined)
    }
  }

  return (
    <section className="play-game card" aria-label="رتّب الكلمات">
      <Progress i={i} n={rounds.length} label="آية" />
      <p className="play-ask">
        رتّب كلمات الآية ({surahName(r.s)} {toArabicDigits(r.a)}):
      </p>
      <p className="play-prompt play-line" aria-label="الكلمات اللي رتبتها">
        {placed.map((k) => r.shuffled[k]).join(' ') || '…'}
      </p>
      <div className="play-chips">
        {r.shuffled.map((w, k) =>
          placed.includes(k) ? null : (
            <button key={k} type="button" className={shake === k ? 'play-chip is-shake' : 'play-chip'} onClick={() => tap(k)}>
              {w}
            </button>
          ),
        )}
      </div>
      {done && (
        <div className="play-feedback" role="status">
          <b>{wrong === 0 ? 'من غير ولا غلطة، برافو!' : `خلصتها، بـ ${toArabicDigits(wrong)} ${wrong === 1 ? 'غلطة' : 'غلطات'}`}</b>
          <button type="button" className="btn btn-primary" onClick={next}>
            {i + 1 >= rounds.length ? 'النتيجة' : 'التالي'}
          </button>
        </div>
      )}
    </section>
  )
}

function ResultCard({ plan, result, onAgain, onOther }: { plan: GamePlan; result: Result; onAgain: () => void; onOther: () => void }) {
  const n = stars(result.correct, result.total)
  const unit = result.game === 'complete' ? 'سؤال' : 'آية من غير غلط'
  const text = `${plan.n} لعب «${GAME_NAME[result.game]}» وجاب ${toArabicDigits(result.correct)} من ${toArabicDigits(result.total)} ${'★'.repeat(n)}`
  return (
    <section className="play-result card" aria-label="النتيجة">
      <p className="play-stars" aria-label={`${toArabicDigits(n)} نجوم`}>
        {'★'.repeat(n)}
        <span>{'★'.repeat(3 - n)}</span>
      </p>
      <p className="play-score">
        {toArabicDigits(result.correct)} من {toArabicDigits(result.total)} {unit}
      </p>
      <a className="btn btn-primary btn-wa" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
        ابعت النتيجة للشيخ
      </a>
      <div className="play-again">
        <button type="button" className="btn btn-quiet" onClick={onAgain}>
          العب تاني
        </button>
        <button type="button" className="btn btn-quiet" onClick={onOther}>
          {result.game === 'complete' ? 'رتّب الكلمات' : 'كمّل الآية'}
        </button>
      </div>
    </section>
  )
}
