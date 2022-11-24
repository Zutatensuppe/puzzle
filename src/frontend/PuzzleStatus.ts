import Game from './../common/GameCommon'
import { Emitter, EventType } from "mitt";

export class PuzzleStatus {
  constructor(
    private gameId: string,
    private eventBus: Emitter<Record<EventType, unknown>>,
  ) {
    // pass
  }

  update(ts: number) {
    const startTs = Game.getStartTs(this.gameId)
    const finishTs = Game.getFinishTs(this.gameId)

    this.eventBus.emit('status', {
      finished: !!(finishTs),
      duration: (finishTs || ts) - startTs,
      piecesDone: Game.getFinishedPiecesCount(this.gameId),
      piecesTotal: Game.getPieceCount(this.gameId),
    })
    this.eventBus.emit('players', {
      active: Game.getActivePlayers(this.gameId, ts),
      idle: Game.getIdlePlayers(this.gameId, ts),
    })
  }
}
