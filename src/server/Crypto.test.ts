import { decrypt, encrypt } from './Crypto'
import { describe, expect, it } from 'vitest'

describe('Crypto.ts', () => {
  describe('decrypt', () => {
    const testCases = [
      { encrypted: '82e8b148c660a5801819e26f26bd9c5b:15291cc243b27dc5f40227458ad69bb8', str: 'hello' },
      { encrypted: '6e8cda1fcc2ed4c59e59d9aec695fa55:ebb8a61e24c498c108ccf83f9a805c78', str: 'hello' },
    ]

    testCases.forEach(({ encrypted, str }) => it('works', () => {
      expect(decrypt(encrypted)).toEqual(str)
    }))
  })

  it('encrypt', () => {
    // encrypt creates random keys each time, so we can only test if
    // encrypting and decrypting returns original value
    const testCases = [
      { str: 'hello' },
      { str: 'haarrr@blub.com' },
    ]

    testCases.forEach(({ str }) => it('works', () => {
      expect(decrypt(encrypt(str))).toEqual(str)
    }))
  })
})
