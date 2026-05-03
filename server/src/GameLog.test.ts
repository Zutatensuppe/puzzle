import type { GameId, LogEntry } from '@common/Types'
import { LOG_TYPE } from '@common/Protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gunzipSync } from 'zlib'
import config from './Config'
import GameLog, { gzFilenameOrFilename } from './GameLog'
import fs from './lib/FileSystem'

describe('GameLog.ts', () => {
  const flushGameId = 'game-log-gzip-flush' as GameId
  const lookupGameId = 'game-log-gzip-lookup' as GameId

  afterEach(() => {
    GameLog.unsetGame(flushGameId)
    GameLog.unsetGame(lookupGameId)
    vi.restoreAllMocks()
  })

  it('gzip-compresses completed log files while keeping current file uncompressed', async () => {
    const baseDir = `${config.dir.DATA_DIR}/log/${flushGameId}`
    const idxFile = `${baseDir}/log_${flushGameId}.idx.log`
    const fullFile0 = `${baseDir}/log_${flushGameId}-0.log`
    const fullFile2 = `${baseDir}/log_${flushGameId}-2.log`
    const fullFile0Gz = `${fullFile0}.gz`

    vi.spyOn(fs, 'exists').mockImplementation((file: string) => Promise.resolve(file === fullFile0))
    const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined)
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined)
    const writeFileRawSpy = vi.spyOn(fs, 'writeFileRaw').mockResolvedValue(undefined)
    const unlinkSpy = vi.spyOn(fs, 'unlink').mockResolvedValue(undefined)

    GameLog.create(flushGameId, 1_000)
    const idx = await GameLog.getIndex(flushGameId)
    expect(idx).not.toBeNull()
    idx!.perFile = 2

    const row1 = [LOG_TYPE.HEADER, 1, 2, 3, 1_000] as unknown as LogEntry
    const row2 = [LOG_TYPE.HEADER, 4, 5, 6, 1_001] as unknown as LogEntry
    const row3 = [LOG_TYPE.HEADER, 7, 8, 9, 1_002] as unknown as LogEntry
    const toLine = (row: LogEntry) => JSON.stringify(row).slice(1, -1)

    GameLog.log(flushGameId, [...row1] as unknown as LogEntry)
    GameLog.log(flushGameId, [...row2] as unknown as LogEntry)
    GameLog.log(flushGameId, [...row3] as unknown as LogEntry)

    await GameLog.flushToDisk(flushGameId)

    expect(mkdirSpy).toHaveBeenCalledWith(baseDir)
    expect(writeFileSpy).toHaveBeenCalledTimes(2)
    expect(writeFileSpy).toHaveBeenCalledWith(idxFile, expect.stringContaining('"perFile":2'))
    expect(writeFileSpy).toHaveBeenCalledWith(fullFile2, toLine(row3))
    expect(writeFileSpy).not.toHaveBeenCalledWith(fullFile0, expect.any(String))

    expect(writeFileRawSpy).toHaveBeenCalledTimes(1)
    const [writtenPath, writtenContent] = writeFileRawSpy.mock.calls[0] as [string, Buffer]
    expect(writtenPath).toBe(fullFile0Gz)
    expect(gunzipSync(writtenContent).toString('utf-8')).toBe(`${toLine(row1)}\n${toLine(row2)}`)

    expect(unlinkSpy).toHaveBeenCalledWith(fullFile0)

    const infos = GameLog.getGameLogInfos()
    expect(infos[flushGameId].logEntriesToFlush).toBe(0)
  })

  it('prefers gz file lookup and falls back to raw file', async () => {
    const baseDir = `${config.dir.DATA_DIR}/log/${lookupGameId}`
    const rawFile = `${baseDir}/log_${lookupGameId}-0.log`
    const gzFile = `${rawFile}.gz`

    const existsSpy = vi.spyOn(fs, 'exists').mockImplementation((file: string) => Promise.resolve(file === gzFile))
    expect(await gzFilenameOrFilename(lookupGameId, 0)).toBe(gzFile)
    expect(existsSpy).toHaveBeenCalledTimes(1)

    existsSpy.mockImplementation((file: string) => Promise.resolve(file === rawFile))
    expect(await gzFilenameOrFilename(lookupGameId, 0)).toBe(rawFile)

    existsSpy.mockResolvedValue(false)
    expect(await gzFilenameOrFilename(lookupGameId, 0)).toBe('')
  })
})
