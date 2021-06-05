import fs from 'fs'
import readline from 'readline'
import stream from 'stream'
import { logger } from '../src/common/Util'
import { DATA_DIR } from '../src/server/Dirs'

const log = logger('rewrite_logs')

const doit = (file: string): Promise<void> => {
  const filename = (offset: number) => file.replace(/\.log$/, `-${offset}.log`)
  const idxname = () => file.replace(/\.log$/, `.idx.log`)

  let perfile = 10000
  const idx = {
    total: 0,
    currentFile: '',
    perFile: perfile,
  }

  return new Promise((resolve) => {
    const instream = fs.createReadStream(DATA_DIR + '/' + file)
    const outstream = new stream.Writable()
    const rl = readline.createInterface(instream, outstream)


    let lines: any[] = []
    let offset = 0
    let count = 0
    rl.on('line', (line) => {
      if (!line) {
        // skip empty
        return
      }
      count++
      lines.push(line)
      if (count >= perfile) {
        const fn = filename(offset)
        idx.currentFile = fn
        idx.total += count
        fs.writeFileSync(DATA_DIR + '/' + fn, lines.join("\n"))
        count = 0
        offset += perfile
        lines = []
      }
    })

    rl.on('close', () => {
      if (count > 0) {
        const fn = filename(offset)
        idx.currentFile = fn
        idx.total += count
        fs.writeFileSync(DATA_DIR + '/' + fn, lines.join("\n"))
        count = 0
        offset += perfile
        lines = []
      }

      fs.writeFileSync(DATA_DIR + '/' + idxname(), JSON.stringify(idx))
      resolve()
    })
  })
}

let logs = fs.readdirSync(DATA_DIR)
  .filter(f => f.toLowerCase().match(/^log_.*\.log$/))


;(async () => {
  for (const file of logs) {
    await doit(file)
  }
})()
