import { DefaultScoreMode, DefaultShapeMode, DefaultSnapMode, LogEntry } from './Types'

export const parseLogFileContents = (
  contents: string,
  offset: number = 0,
): LogEntry[] => {
  const lines = contents.split('\n')
  const log = lines.filter(line => !!line).map(line => {
    return JSON.parse(`[${line}]`)
  })
  if (offset === 0 && log.length > 0) {
    log[0][5] = DefaultScoreMode(log[0][5])
    log[0][6] = DefaultShapeMode(log[0][6])
    log[0][7] = DefaultSnapMode(log[0][7])
    log[0][8] = log[0][8] || null // creatorUserId
    log[0][9] = log[0][9] || 0 // private
    log[0][10] = log[0][10] || undefined // crop
  }
  return log
}
