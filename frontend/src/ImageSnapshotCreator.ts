import { EncodedPiece, EncodedPlayer, GameId, PlayerSettingsData, createDefaultPlayerSettingsData } from '../../common/src/Types'
import GameCommon from '../../common/src/GameCommon'
import { Renderer } from '../../common/src/Renderer'
import { Camera } from '../../common/src/Camera'
import { logger } from '../../common/src/Util'
import { RendererWebgl } from './RendererWebgl'

const log = logger('ImageSnapshotCreator.ts')

export const createImageSnapshot = (
  gameId: GameId,
  renderer: Renderer,
): HTMLCanvasElement => {
  const boardDim = GameCommon.getBoardDim(gameId)
  const tableDim = GameCommon.getTableDim(gameId)

  const canvas = document.createElement('canvas')
  canvas.width = boardDim.w
  canvas.height = boardDim.h

  const playerSettings: PlayerSettingsData = createDefaultPlayerSettingsData()
  playerSettings.showTable = false

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
  renderer.render(
    canvas,
    ctx,
    viewport,
    new Date().getTime(),
    playerSettings,
    null,
    { update: (_ts: number) => { return } },
    (_piece: EncodedPiece) => true,
    (_player: EncodedPlayer) => false,
    false,
    true,
  )
  return canvas
}


export const createImageSnapshotWebgl = (
  gameId: GameId,
  renderer: RendererWebgl,
): string => {
  console.log('createImageSnapshotWebgl')
  const boardDim = GameCommon.getBoardDim(gameId)
  const tableDim = GameCommon.getTableDim(gameId)

  const playerSettings: PlayerSettingsData = createDefaultPlayerSettingsData()
  playerSettings.showTable = false

  const viewport = new Camera()
  viewport.calculateZoomCapping(boardDim, tableDim)
  viewport.centerFit(
    { w: boardDim.w, h: boardDim.h },
    tableDim,
    boardDim,
    0,
  )

  return renderer.renderToImageString(
    boardDim,
    viewport,
    new Date().getTime(),
    playerSettings,
    (_piece: EncodedPiece) => true,
    (_player: EncodedPlayer) => false,
    true,
  )
}
