import { useState } from 'react'
import type { GameInfo } from '../../domain/gameCatalog'
import type { QuranText } from '../../domain/mushaf'
import { quizQuestions, type Question, type QuizType } from '../../domain/quiz'
import { useCelebrate, useSaveResult, useScore, type GameSetup, type Judgement } from './gameHooks'
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
  const [saved, setSaved] = useState<boolean>()
  const { score, review, add } = useScore()
  const { celebrate, layer } = useCelebrate()
  const { save } = useSaveResult(setup)
  const tap = info.choice && setup.mode === 'tap'
  const x = questions[i]

  function next(j: Judgement) {
    add(j, x.review)
    if (j === 'ok' && !tap) celebrate()
    if (i + 1 < questions.length) {
      setI(i + 1)
      setShown(false)
      setPicked(undefined)
    } else {
      const final = { ok: score.ok + (j === 'ok' ? 1 : 0), help: score.help + (j === 'help' ? 1 : 0), bad: score.bad + (j === 'bad' ? 1 : 0) }
      const rev = j !== 'ok' && !review.includes(x.review) ? [...review, x.review] : review
      setSaved(save({ game: info.id, title: info.title, ...final, surahs: setup.surahs, review: rev }))
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
    return (
      <GameFrame info={info} setup={setup}>
        <ResultView info={info} setup={setup} score={score} review={review} saved={!!saved} onAgain={onAgain} />
      </GameFrame>
    )
  }

  return (
    <GameFrame info={info} setup={setup}>
      {layer}
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
                    if (o === x.answer) celebrate()
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
              {i + 1 < questions.length ? 'التالي' : 'النتيجة'}
            </button>
          </div>
        )
      ) : (
        <JudgeBar onJudge={next} />
      )}
    </GameFrame>
  )
}
