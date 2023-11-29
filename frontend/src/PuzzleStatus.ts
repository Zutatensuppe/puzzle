import GameCommon from '../../common/src/GameCommon'
import { Game } from './Game'
import { PuzzleStatusInterface } from '../../common/src/Types'

export class PuzzleStatus implements PuzzleStatusInterface {
  constructor(private game: Game<any>) {
    // pass
  }

  update(ts: number) {
    const startTs = GameCommon.getStartTs(this.game.getGameId())
    const finishTs = GameCommon.getFinishTs(this.game.getGameId())

    this.game.changeStatus({
      finished: !!(finishTs),
      duration: (finishTs || ts) - startTs,
      piecesDone: GameCommon.getFinishedPiecesCount(this.game.getGameId()),
      piecesTotal: GameCommon.getPieceCount(this.game.getGameId()),
    })

    this.game.changePlayers({
      active: GameCommon.getActivePlayers(this.game.getGameId(), ts),
      idle: GameCommon.getIdlePlayers(this.game.getGameId(), ts),
    })
  }
}
