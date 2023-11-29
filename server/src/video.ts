// http://localhost:5173/replay/li7cstret0s2ijzjjuh

import { Game, Piece, Player, ReplayData, Timestamp } from '../../common/src/Types'
import { createCanvas, CanvasRenderingContext2D } from 'canvas'
// @ts-ignore
import { polyfillPath2D } from 'path2d-polyfill'
import fs from 'fs'
import { Graphics } from './Graphics'
import { Assets } from './Assets'
import GameCommon from '../../common/src/GameCommon'
import Protocol from '../../common/src/Protocol'
import { Renderer } from '../../common/src/Renderer'
import { PlayerCursors } from '../../common/src/PlayerCursors'
import { Camera } from '../../common/src/Camera'
import { PuzzleTable } from '../../common/src/PuzzleTable'
import fireworksController from '../../common/src/Fireworks'
import Util from '../../common/src/Util'

// @ts-ignore
global.CanvasRenderingContext2D = CanvasRenderingContext2D
polyfillPath2D(global)

const BASE_URL = 'http://localhost:5173'
const OUT_DIR = __dirname + '/out'

const loadLog = async () => {
  // load via api
  const size = 10_000
  let offset = 0
  const gameId = 'leivg2y8u81sjfjsgng'

  const completeLog: any[] = []
  let logTmp = []
  let game: Game | null = null
  do {
    const res = await fetch(BASE_URL + '/api/replay-data?' + new URLSearchParams({ size: `${size}`, offset: `${offset}`, gameId }))
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

const createImages = async (game: Game, completeLog: any[]) => {
  const gameId = game.id

  const canvas = createCanvas(1024, 768)

  const graphics = new Graphics(BASE_URL)
  const assets = new Assets()
  await assets.init(graphics)
  const playerCursors = new PlayerCursors(
    canvas as unknown as HTMLCanvasElement,
    assets,
    graphics,
  )
  const viewport = new Camera()

  GameCommon.setGame(gameId, game)
  const fireworks = new fireworksController(
    canvas as unknown as HTMLCanvasElement,
    GameCommon.getRng(gameId),
  )
  const renderer = new Renderer(
    gameId,
    canvas as unknown as HTMLCanvasElement,
    viewport,
    fireworks,
  )
  await renderer.init(graphics)

  const puzzleTable = new PuzzleTable(gameId, assets, graphics)
  await puzzleTable.init()
  renderer.puzzleTable = puzzleTable

  // GO THROUGH COMPLETE LOG
  let gameTs = parseInt(completeLog[0][4], 10)

  const playerSettings = {
    background: '#ababab',
    showTable: true,
    tableTexture: 'dark',
    color: '#ffffff',
    name: 'none',
    soundsEnabled: false,
    otherPlayerClickSoundEnabled: false,
    soundsVolume: 0,
    showPlayerNames: true,
  }

  let i = 1
  for (const entry of completeLog) {
    const currTs: Timestamp = gameTs + (
      entry[0] === Protocol.LOG_HEADER
        ? 0
        : entry[entry.length - 1]
    )
    if (GameCommon.handleLogEntry(gameId, entry, currTs)) {
      // create image
      await renderer.render(
        currTs,
        playerSettings,
        playerCursors,
        { update: (_ts: number) => { return } },
        (_piece: Piece) => true,
        (_player: Player) => true,
        false,
      )

      const data = canvas.toDataURL('image/jpeg', 60)
      fs.writeFileSync(
        `${OUT_DIR}/test_${currTs}.jpeg`,
        new Buffer(data.split(',')[1], 'base64'),
      )
      console.log(`FRAME created. ${i}/${completeLog.length}`)
    }
    gameTs = currTs
    i++
  }
}

const createImageListForFfmpeg = async () => {
  const fileList = []
  for (const f of fs.readdirSync(OUT_DIR, { withFileTypes: true })) {
    if (f.name.endsWith('.jpeg')) {
      fileList.push('file ' + f.path.replace(/\\/g, '/') + '/' + f.name)
      fileList.push('duration 1')
    }
  }
  fs.writeFileSync(`${OUT_DIR}/out.txt`, fileList.join('\n'))
}

(async () => {
  const { game, completeLog } = await loadLog()
  await createImages(game, completeLog)
  await createImageListForFfmpeg()
  // ffmpeg -r 30 -f concat -safe 0 -i 'out.txt' -c:v libx264 -pix_fmt yuv420p out.mp4
})()
