import '@fontsource/amiri-quran/arabic-400.css'
import { Link, useParams } from 'react-router'
import { useGameContent } from '../../data/data'
import { gameInfo } from '../../domain/gameCatalog'
import { useQuran } from '../../lib/quranText'
import { MatchGame, PicGame, SituationGame } from './ContentGames'
import { QuizGame } from './QuizGame'
import { useGameSetup } from './gameHooks'
import { EraseGame, OrderGame } from './VerseGames'

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
  if (failed) return <p className="empty card">تعذّر تحميل المصحف. اتأكد من النت وافتح الصفحة تاني.</p>
  if (!quran || loading) {
    return (
      <p className="mushaf-loading" role="status">
        جارٍ التحميل…
      </p>
    )
  }
  const key = `${info.id}?${setup.query}`
  switch (info.id) {
    case 'order':
      return <OrderGame key={key} info={info} setup={setup} quran={quran} />
    case 'erase':
      return <EraseGame key={key} info={info} setup={setup} quran={quran} />
    case 'pic':
      return <PicGame key={key} info={info} setup={setup} content={content} />
    case 'match':
      return <MatchGame key={key} info={info} setup={setup} content={content} />
    case 'situation':
      return <SituationGame key={key} info={info} setup={setup} quran={quran} content={content} />
    default:
      return <QuizGame key={key} info={info} setup={setup} quran={quran} />
  }
}
