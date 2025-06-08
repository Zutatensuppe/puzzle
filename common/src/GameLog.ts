import { DefaultScoreMode, DefaultShapeMode, DefaultSnapMode } from './Types'
import type { LogEntry } from './Types'

export const parseLogFileContents = (
  contents: string,
  logFileIdx: number = 0,
): LogEntry[] => {
  const log: LogEntry[] = []
  for (const line of contents.split('\n')) {
    if (!line) {
      continue
    }
    log.push(JSON.parse(`[${line}]`))
  }
  if (logFileIdx === 0 && log.length > 0) {
    log[0][5] = DefaultScoreMode(log[0][5])
    log[0][6] = DefaultShapeMode(log[0][6])
    log[0][7] = DefaultSnapMode(log[0][7])
    log[0][8] = log[0][8] || null // creatorUserId
    log[0][9] = log[0][9] || 0 // private
    log[0][10] = log[0][10] || undefined // crop
  }
  return log
}
