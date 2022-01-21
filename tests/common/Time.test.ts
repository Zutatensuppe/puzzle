import Time from '../../src/common/Time'

describe('Time.ts', () => {
  test.each([
    {duration: 50, expected: '0d 0h 0m 0s'},
    {duration: 999, expected: '0d 0h 0m 0s'},
    {duration: 1000, expected: '0d 0h 0m 1s'},
    {duration: 12030000, expected: '0d 3h 20m 30s'},
    {duration: 242030000, expected: '2d 19h 13m 50s'},
  ])('durationStr $duration', ({duration, expected}) => {
    expect(Time.durationStr(duration)).toBe(expected)
  })
  test.each([
    {from: 10000, to: 20000, expected: '0d 0h 0m 10s'},
    {from: 88888, to: 42069000, expected: '0d 11h 39m 40s'},
  ])('timeDiffStr $from - $to', ({from, to, expected}) => {
    expect(Time.timeDiffStr(from, to)).toBe(expected)
  })
})
