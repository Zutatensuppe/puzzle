// http://localhost:5173/replay/li7cstret0s2ijzjjuh

import { Game, PLAYER_SETTINGS_DEFAULTS, Piece, Player, ReplayData, Timestamp } from '../../common/src/Types'
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
import Util, { logger } from '../../common/src/Util'
import { spawn } from 'child_process'


const log = logger('video.ts')

// @ts-ignore
global.CanvasRenderingContext2D = CanvasRenderingContext2D
polyfillPath2D(global)

const OUT_DIR = __dirname + '/out'
const DIM = { w: 1024, h: 768 }
const SPEED = 30

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

const createImages = async (game: Game, outDir: string, baseUrl: string, completeLog: any[]) => {
  const gameId = game.id
  const canvas = createCanvas(DIM.w, DIM.h) as unknown as HTMLCanvasElement
  const graphics = new Graphics(baseUrl)

  log.info('initializing assets')
  const assets = new Assets()
  await assets.init(graphics)
  log.info('assets inited')

  const playerCursors = new PlayerCursors(canvas, assets, graphics)
  const viewport = new Camera()
  GameCommon.setGame(gameId, game)
  const rng = GameCommon.getRng(gameId)
  const fireworks = new fireworksController(canvas, rng)

  log.info('initializing puzzleTable')
  const puzzleTable = new PuzzleTable(gameId, assets, graphics)
  await puzzleTable.init()
  log.info('puzzleTable inited')

  log.info('initializing renderer')
  const renderer = new Renderer(gameId, canvas, viewport, fireworks, puzzleTable, true)
  await renderer.init(graphics)
  log.info('renderer inited')

  const piecesBounds = GameCommon.getPiecesBounds(gameId)
  const tableWidth = GameCommon.getTableWidth(gameId)
  const tableHeight = GameCommon.getTableHeight(gameId)
  const puzzleWidth = GameCommon.getPuzzleWidth(gameId)
  const puzzleHeight = GameCommon.getPuzzleHeight(gameId)
  const boardDim = { w: puzzleWidth, h: puzzleHeight }
  const tableDim = { w: tableWidth, h: tableHeight }

  // center of puzzle
  const center = { x: tableDim.w / 2, y: tableDim.h / 2 }
  const maxYDiff = Math.max(Math.abs(center.y - piecesBounds.y), Math.abs(piecesBounds.y + piecesBounds.h - center.y))
  const maxXDiff = Math.max(Math.abs(center.x - piecesBounds.x), Math.abs(piecesBounds.x + piecesBounds.w - center.x))

  const border = Math.max(maxYDiff - (boardDim.h / 2), maxXDiff - (boardDim.w / 2))
  // console.log(border)
  viewport.calculateZoomCapping(DIM, tableDim)
  viewport.centerFit(
    { w: canvas.width, h: canvas.height },
    tableDim,
    boardDim,
    20,
  )

  // GO THROUGH COMPLETE LOG
  let gameTs = parseInt(completeLog[0][4], 10)

  const playerSettings = {
    background: PLAYER_SETTINGS_DEFAULTS.COLOR_BACKGROUND,
    showTable: PLAYER_SETTINGS_DEFAULTS.SHOW_TABLE,
    tableTexture: PLAYER_SETTINGS_DEFAULTS.TABLE_TEXTURE,
    color: PLAYER_SETTINGS_DEFAULTS.PLAYER_COLOR,
    name: PLAYER_SETTINGS_DEFAULTS.PLAYER_NAME,
    soundsEnabled: PLAYER_SETTINGS_DEFAULTS.SOUND_ENABLED,
    otherPlayerClickSoundEnabled: PLAYER_SETTINGS_DEFAULTS.OTHER_PLAYER_CLICK_SOUND_ENABLED,
    soundsVolume: PLAYER_SETTINGS_DEFAULTS.SOUND_VOLUME,
    showPlayerNames: PLAYER_SETTINGS_DEFAULTS.SHOW_PLAYER_NAMES,
  }

  let entry = null
  for (let i = 0; i < completeLog.length; i++) {
    entry = completeLog[i]
    const currTs: Timestamp = gameTs + (
      entry[0] === Protocol.LOG_HEADER
        ? 0
        : entry[entry.length - 1]
    )
    if (GameCommon.handleLogEntry(gameId, entry, currTs)) {
      if (i % SPEED === 0 || i + 1 === completeLog.length) {
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
          `${outDir}/${currTs}.jpeg`,
          new Buffer(data.split(',')[1], 'base64'),
        )
        console.log(`FRAME created. ${i+1}/${completeLog.length}`)
      }
    }
    gameTs = currTs
  }
}

const createImageListForFfmpeg = async (outDir: string) => {
  const fileList = []
  for (const f of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (f.name.endsWith('.jpeg')) {
      fileList.push('file ' + f.path.replace(/\\/g, '/') + '/' + f.name)
      fileList.push('duration 1')
    }
  }
  const listFile = `${outDir}/out.txt`
  fs.writeFileSync(listFile, fileList.join('\n'))
  return listFile
}

const createVideo = async (listFile: string, outDir: string) => {
  return new Promise<string>((resolve, reject) => {
    const outFile = `${outDir}/out.mp4`
    // ffmpeg -r 30 -f concat -safe 0 -i 'out.txt' -c:v libx264 -pix_fmt yuv420p out.mp4
    const ffmpeg = spawn('ffmpeg', [
      '-y', // overwrite file if exists
      '-r', '30',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      outFile,
    ])
    ffmpeg.stdout.on('data', data => {
      console.log(`stdout: ${data}`)
    })
    ffmpeg.stderr.on('data', data => {
      console.log(`stderr: ${data}`)
    })
    ffmpeg.on('error', (error) => {
      console.log(`error: ${error.message}`)
      reject(error)
    })
    ffmpeg.on('close', code => {
      console.log(`child process exited with code ${code}`)
      if (code !== 0) {
        reject(new Error(`invalid return code ${code}`))
        return
      }
      resolve(outFile)
    })
  })
}

(async () => {
  const url = process.argv[2]
  if (!url) {
    return
  }
  const m = url.match(/(https?:\/\/[^/]+)\/(g|replay)\/([a-z0-9]+)$/)
  if (!m) {
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
  const listFile = await createImageListForFfmpeg(outDir)
  await createVideo(listFile, outDir)
})()
