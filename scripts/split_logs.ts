import fs from 'fs'
import { logger } from '../common/src/Util'
import config from '../server/src/Config'
import { filename } from '../server/src/GameLog'

const log = logger('rewrite_logs')

interface IdxOld {
  total: number
  currentFile: string
  perFile: number
}

interface Idx {
  gameId: string
  total: number
  lastTs: number
  currentFile: string
  perFile: number
}
const doit = (idxfile: string): void => {
  const gameId: string = (idxfile.match(/^log_([a-z0-9]+)\.idx\.log$/) as any[])[1]
  const idxOld: IdxOld = JSON.parse(fs.readFileSync(config.dir.DATA_DIR + '/' + idxfile, 'utf-8'))

  let currentFile = filename(gameId, 0)
  const idxNew: Idx = {
    gameId: gameId,
    total: 0,
    lastTs: 0,
    currentFile: currentFile,
    perFile: idxOld.perFile,
  }

  let firstTs = 0
  while (fs.existsSync(currentFile)) {
    idxNew.currentFile = currentFile
    const log = fs.readFileSync(currentFile, 'utf-8').split('\n')
    const newLines: string[] = []
    const lines = log.filter(line => !!line).map(line => {
      return JSON.parse(line)
    })
    for (const l of lines) {
      if (idxNew.total === 0) {
        firstTs = l[4]
        idxNew.lastTs = l[4]
        newLines.push(JSON.stringify(l).slice(1, -1))
      } else {
        const ts = firstTs + l[l.length - 1]
        const diff = ts - idxNew.lastTs
        idxNew.lastTs = ts
        const newL = l.slice(0, -1)
        newL.push(diff)
        newLines.push(JSON.stringify(newL).slice(1, -1))
      }
      idxNew.total++
    }
    fs.writeFileSync(idxNew.currentFile, newLines.join('\n') + '\n')
    currentFile = filename(gameId, idxNew.total)
  }

  fs.writeFileSync(config.dir.DATA_DIR + '/' + idxfile, JSON.stringify(idxNew))
  console.log('done: ' + gameId)
}

const indexfiles = fs.readdirSync(config.dir.DATA_DIR)
  .filter(f => f.toLowerCase().match(/^log_[a-z0-9]+\.idx\.log$/))


;(async () => {
  for (const file of indexfiles) {
    await doit(file)
  }
})()
