// http://localhost:5173/replay/li7cstret0s2ijzjjuh

import { Game, HeaderLogEntry, LogEntry, PLAYER_SETTINGS_DEFAULTS, Piece, Player, PlayerSettingsData, ReplayData, Timestamp } from '../../common/src/Types'
import { createCanvas, CanvasRenderingContext2D } from 'canvas'
// @ts-ignore
import { polyfillPath2D } from 'path2d-polyfill'
import fs from 'fs'
import { Graphics } from './Graphics'
import GameCommon from '../../common/src/GameCommon'
import { LOG_TYPE } from '../../common/src/Protocol'
import { Renderer } from '../../common/src/Renderer'
import { Camera } from '../../common/src/Camera'
import Util, { logger } from '../../common/src/Util'


const log = logger('video.ts')

// @ts-ignore
global.CanvasRenderingContext2D = CanvasRenderingContext2D
polyfillPath2D(global)

const OUT_DIR = __dirname + '/out'

const loadLog = async (gameId: string, baseUrl: string) => {
  // load via api
  const size = 10_000
  let offset = 0
  const completeLog: any[] = []
  let logTmp = []
  let game: Game | null = null
  do {
    const res = await fetch(baseUrl + '/api/replay-data?' + new URLSearchParams({ size: `${size}`, offset: `${offset}`, gameId }))
    const data = await res.json() as ReplayData
    logTmp = data.log
    if (logTmp.length === 0) {
      break
    }
    if (data.game) {
      game = Util.decodeGame(data.game)
    }
    completeLog.push(...logTmp)
    offset += size
  } while (logTmp.length > 0)
  if (!game) {
    console.error('no game')
    process.exit(0)
  }
  return { game, completeLog }
}

const createImages = async (game: Game, outDir: string, baseUrl: string, completeLog: LogEntry[]) => {
  const gameId = game.id
  GameCommon.setGame(gameId, game)
  const boardDim = GameCommon.getBoardDim(gameId)
  const tableDim = GameCommon.getTableDim(gameId)
  const canvas = createCanvas(boardDim.w, boardDim.h) as unknown as HTMLCanvasElement
  const graphics = new Graphics(baseUrl)

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

  log.info('initializing renderer')
  const renderer = new Renderer(gameId, canvas, viewport, null, null, true, true, true)
  await renderer.init(graphics)
  log.info('renderer inited')

  // console.log(border)
  viewport.calculateZoomCapping(boardDim, tableDim)
  viewport.centerFit(
    { w: canvas.width, h: canvas.height },
    tableDim,
    boardDim,
    0,
  )

  // GO THROUGH COMPLETE LOG
  const header = completeLog[0] as HeaderLogEntry
  let gameTs = header[4]

  const inc = Math.floor(completeLog.length / 10)
  let entry = null
  for (let i = 0; i < completeLog.length; i++) {
    entry = completeLog[i]
    const currTs: Timestamp = gameTs + (
      entry[0] === LOG_TYPE.HEADER ? 0 : (entry[entry.length - 1] as Timestamp)
    )
    if (GameCommon.handleLogEntry(gameId, entry, currTs)) {
      if (i % inc === 0 || i + 1 === completeLog.length) {
        // create image
        await renderer.render(
          currTs,
          playerSettings,
          null,
          { update: (_ts: number) => { return } },
          (_piece: Piece) => true,
          (_player: Player) => true,
          false,
        )

        const data = canvas.toDataURL('image/jpeg', 75)
        fs.writeFileSync(
          `${outDir}/${currTs}.jpeg`,
          new Buffer(data.split(',')[1], 'base64'),
        )
        console.log(`FRAME created. ${i+1}/${completeLog.length}`)
      }
    }
    gameTs = currTs
  }
}

(async () => {
  const url = process.argv[2]
  if (!url) {
    console.log('no url given')
    return
  }
  const m = url.match(/(https?:\/\/[^/]+)\/(g|replay)\/([a-z0-9]+)$/)
  if (!m) {
    console.log('url doesn\'t match expected format')
    return
  }
  const gameId = m[3]
  const baseUrl = m[1]

  const outDir = OUT_DIR + '/' + gameId
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }
  const { game, completeLog } = await loadLog(gameId, baseUrl)
  await createImages(game, outDir, baseUrl, completeLog)
})()
