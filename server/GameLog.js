import fs from 'fs'

const DATA_DIR = './../data'

const log = (gameId, ...args) => {
  const str = JSON.stringify(args)
  fs.appendFileSync(`${DATA_DIR}/log_${gameId}.log`, str + "\n")
}

const get = (gameId) => {
  const all = fs.readFileSync(`${DATA_DIR}/log_${gameId}.log`, 'utf-8')
  return all.split("\n").filter(line => !!line).map((line) => {
    try {
      return JSON.parse(line)
    } catch (e) {
      console.log(line)
      console.log(e)
    }
  })
}

export default {
  log,
  get,
}
