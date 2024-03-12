import { PLAYER_SETTINGS_DEFAULTS, Piece, Player, PlayerSettingsData } from '../../common/src/Types'
import GameCommon from '../../common/src/GameCommon'
import { Renderer } from '../../common/src/Renderer'
import { Camera } from '../../common/src/Camera'
import { logger } from '../../common/src/Util'

const log = logger('ImageSnapshotCreator.ts')

export const createImageSnapshot = async (
  gameId: string,
  renderer: Renderer,
): Promise<HTMLCanvasElement> => {
  const boardDim = GameCommon.getBoardDim(gameId)
  const tableDim = GameCommon.getTableDim(gameId)

  const canvas = document.createElement('canvas')
  canvas.width = boardDim.w
  canvas.height = boardDim.h

  const playerSettings: PlayerSettingsData = {
    background: PLAYER_SETTINGS_DEFAULTS.COLOR_BACKGROUND,
    showTable: PLAYER_SETTINGS_DEFAULTS.SHOW_TABLE,
    tableTexture: PLAYER_SETTINGS_DEFAULTS.TABLE_TEXTURE,
    useCustomTableTexture: PLAYER_SETTINGS_DEFAULTS.USE_CUSTOM_TABLE_TEXTURE,
    customTableTexture: PLAYER_SETTINGS_DEFAULTS.CUSTOM_TABLE_TEXTURE,
    customTableTextureScale: PLAYER_SETTINGS_DEFAULTS.CUSTOM_TABLE_TEXTURE_SCALE,
    color: PLAYER_SETTINGS_DEFAULTS.PLAYER_COLOR,
    name: PLAYER_SETTINGS_DEFAULTS.PLAYER_NAME,
    soundsEnabled: PLAYER_SETTINGS_DEFAULTS.SOUND_ENABLED,
    otherPlayerClickSoundEnabled: PLAYER_SETTINGS_DEFAULTS.OTHER_PLAYER_CLICK_SOUND_ENABLED,
    soundsVolume: PLAYER_SETTINGS_DEFAULTS.SOUND_VOLUME,
    showPlayerNames: PLAYER_SETTINGS_DEFAULTS.SHOW_PLAYER_NAMES,
  }

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
