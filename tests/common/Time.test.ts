import Time from '../../src/common/Time'
import { describe, expect, it } from 'vitest'

describe('Time.ts', () => {
  [
    {duration: 50, expected: '0d 0h 0m 0s'},
    {duration: 999, expected: '0d 0h 0m 0s'},
    {duration: 1000, expected: '0d 0h 0m 1s'},
    {duration: 12030000, expected: '0d 3h 20m 30s'},
    {duration: 242030000, expected: '2d 19h 13m 50s'},
  ].forEach(({duration, expected}) => it('durationStr $duration', () => {
    expect(Time.durationStr(duration)).toBe(expected)
  }))

  ;[
    {from: 10000, to: 20000, expected: '0d 0h 0m 10s'},
    {from: 88888, to: 42069000, expected: '0d 11h 39m 40s'},
  ].forEach(({from, to, expected}) => it('timeDiffStr $from - $to', () => {
    expect(Time.timeDiffStr(from, to)).toBe(expected)
  }))
})
