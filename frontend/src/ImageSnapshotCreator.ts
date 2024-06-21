import { GameId, Piece, Player, PlayerSettingsData, createDefaultPlayerSettingsData } from '../../common/src/Types'
import GameCommon from '../../common/src/GameCommon'
import { Renderer } from '../../common/src/Renderer'
import { Camera } from '../../common/src/Camera'
import { logger } from '../../common/src/Util'

const log = logger('ImageSnapshotCreator.ts')

export const createImageSnapshot = async (
  gameId: GameId,
  renderer: Renderer,
): Promise<HTMLCanvasElement> => {
  const boardDim = GameCommon.getBoardDim(gameId)
  const tableDim = GameCommon.getTableDim(gameId)

  const canvas = document.createElement('canvas')
  canvas.width = boardDim.w
  canvas.height = boardDim.h

  const playerSettings: PlayerSettingsData = createDefaultPlayerSettingsData()

  const viewport = new Camera()
  viewport.calculateZoomCapping(boardDim, tableDim)
  viewport.centerFit(
    { w: canvas.width, h: canvas.height },
    tableDim,
    boardDim,
    0,
  )

  // create image
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  await renderer.render(
    canvas,
    ctx,
    viewport,
    new Date().getTime(),
    playerSettings,
    null,
    { update: (_ts: number) => { return } },
    (_piece: Piece) => true,
    (_player: Player) => false,
    false,
    true,
  )
  return canvas
}
