import { useEffect, useState } from 'react'
import type { GameInfo } from '../../domain/gameCatalog'
import type { QuranText } from '../../domain/mushaf'
import { quizQuestions, type Question, type QuizType } from '../../domain/quiz'
import { useFeedback, useFinish, useScore, type GameSetup, type Judgement } from './gameHooks'
import { GameFrame, JudgeBar, Progress, ResultView } from './shared'

/** One memorisation game: the student answers aloud and the teacher judges, or taps one of the options. */
export function QuizGame({ info, setup, quran }: { info: GameInfo; setup: GameSetup; quran: QuranText }) {
  const [round, setRound] = useState(0)
  return <QuizRound key={round} info={info} setup={setup} quran={quran} onAgain={() => setRound((r) => r + 1)} />
}

function QuizRound({ info, setup, quran, onAgain }: { info: GameInfo; setup: GameSetup; quran: QuranText; onAgain: () => void }) {
  const [questions] = useState<Question[]>(() => quizQuestions(info.id as QuizType, quran, setup.surahs, Math.random, setup.count))
  const [i, setI] = useState(0)
  const [shown, setShown] = useState(false)
  const [picked, setPicked] = useState<string>()
  const [saved, setSaved] = useState(false)
  const { score, review, add } = useScore()
  const fb = useFeedback()
  const finish = useFinish(info, setup)
  const tap = info.choice && setup.mode === 'tap'
  const x = questions[i]

  // Space shows the answer (teacher judging), on a keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !tap && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault()
        setShown(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tap])

  // No questions possible: in a series, move on to the next game.
  useEffect(() => {
    if (!questions.length) setup.session?.onDone({ ok: 0, help: 0, bad: 0 }, [])
  }, [questions.length, setup.session])

  function next(j: Judgement) {
    const r = add(j, x.review)
    if (!tap) fb.judge(j)
    if (i + 1 < questions.length) {
      setI(i + 1)
      setShown(false)
      setPicked(undefined)
    } else {
      setSaved(finish(r))
      setI(questions.length)
    }
  }

  if (!questions.length) {
    return (
      <GameFrame info={info} setup={setup}>
        <section className="empty card">
          <p>السور المختارة مش كفاية للعبة دي. اختار سور أكتر من صفحة الألعاب.</p>
        </section>
      </GameFrame>
    )
  }

  if (i >= questions.length) {
    if (setup.session) return null
    return (
      <GameFrame info={info} setup={setup}>
        <ResultView info={info} setup={setup} score={score} review={review} saved={saved} onAgain={onAgain} />
      </GameFrame>
    )
  }

  return (
    <GameFrame info={info} setup={setup} score={score}>
      {fb.layer}
      <section className="game-card card" aria-label="السؤال">
        <Progress i={i} n={questions.length} />
        <p className="game-ask">{x.ask}</p>
        {x.plain && <p className="game-plain">{x.plain}</p>}
        {x.quran && <p className="game-quran">{x.quran}</p>}

        {x.options && (tap || shown) && (
          <div className="game-options">
            {x.options.map((o) => {
              const state = !(picked || shown) ? '' : o === x.answer ? ' is-right' : o === picked ? ' is-wrong' : ''
              return (
                <button
                  key={o}
                  type="button"
                  className={`game-option${x.optionsAreQuran ? ' is-quran' : ''}${state}`}
                  disabled={!tap || !!picked}
                  onClick={() => {
                    setPicked(o)
                    if (o === x.answer) fb.ok()
                    else fb.bad()
                  }}
                >
                  {o}
                </button>
              )
            })}
          </div>
        )}

        {!x.options && shown && (
          <div className="game-answer">
            <span className="field-hint">الإجابة</span>
            <p className={x.answerIsQuran ? 'game-quran' : 'game-plain'}>{x.answer}</p>
          </div>
        )}
        {!tap && !shown && (
          <button type="button" className="btn btn-quiet game-reveal" onClick={() => setShown(true)}>
            {x.options ? 'اعرض الاختيارات' : 'اعرض الإجابة'}
          </button>
        )}
        {(shown || picked) && <p className="game-where field-hint">{x.review}</p>}
      </section>

      {tap ? (
        picked && (
          <div className="game-next">
            <b>{picked === x.answer ? 'صح، برافو!' : 'الإجابة الصح متعلّم عليها بالأخضر'}</b>
            <button type="button" className="btn btn-primary" onClick={() => next(picked === x.answer ? 'ok' : 'bad')}>
              {i + 1 < questions.length ? 'التالي' : setup.session ? 'اللعبة اللي بعدها' : 'النتيجة'}
            </button>
          </div>
        )
      ) : (
        <JudgeBar onJudge={next} />
      )}
    </GameFrame>
  )
}
