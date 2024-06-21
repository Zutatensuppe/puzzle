import { UrlUtil } from './UrlUtil'
import { describe, expect, it } from 'vitest'

describe('UrlUtil.ts', () => {
  describe('fixUrl', () => {
    const testCases = [
      { url: '', expected: '' },
      { url: '0', expected: 'https://0' },
      { url: 'https://example.com', expected: 'https://example.com' },
      { url: 'http://example.com', expected: 'http://example.com' },
      { url: '//example.com', expected: '//example.com' },
      { url: 'example.com', expected: 'https://example.com' },
    ]

    testCases.forEach(({ url, expected }) => it(url, () => {
      const actual = new UrlUtil().fixUrl(url)
      expect(actual).toEqual(expected)
    }))
  })
})
