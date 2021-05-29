import fs from 'fs'
import readline from 'readline'
import stream from 'stream'
import { logger } from './../common/Util'
import { DATA_DIR } from './../server/Dirs'

const log = logger('GameLog.js')

const filename = (gameId: string) => `${DATA_DIR}/log_${gameId}.log`

const create = (gameId: string) => {
  const file = filename(gameId)
  if (!fs.existsSync(file)) {
    fs.appendFileSync(file, '')
  }
}

const exists = (gameId: string) => {
  const file = filename(gameId)
  return fs.existsSync(file)
}

const _log = (gameId: string, ...args: Array<any>) => {
  const file = filename(gameId)
  if (!fs.existsSync(file)) {
    return
  }
  const str = JSON.stringify(args)
  fs.appendFileSync(file, str + "\n")
}

const get = async (
  gameId: string,
  offset: number = 0,
  size: number = 10000
): Promise<any[]> => {
  const file = filename(gameId)
  if (!fs.existsSync(file)) {
    return []
  }
  return new Promise((resolve) => {
    const instream = fs.createReadStream(file)
    const outstream = new stream.Writable()
    const rl = readline.createInterface(instream, outstream)
    const lines: any[] = []
    let i = -1
    rl.on('line', (line) => {
      if (!line) {
        // skip empty
        return
      }
      i++
      if (offset > i) {
        return
      }
      if (offset + size <= i) {
        rl.close()
        return
      }
      lines.push(JSON.parse(line))
    })
    rl.on('close', () => {
      resolve(lines)
    })
  })
}

export default {
  create,
  exists,
  log: _log,
  get,
}
