import { decrypt, encrypt } from './Crypto'
import { describe, expect, it } from 'vitest'

describe('Crypto.ts', () => {
  describe('decrypt/decrypt', () => {
    const testCases = [
      { encrypted: 'ZDRhOTcwZWY1NTQ2ZDEyMjE5ZjJiNjYwMTQ5OTYzNDhoZWxsbw==', decrypted: 'hello' },
      { encrypted: 'ZDRhOTcwZWY1NTQ2ZDEyMjE5ZjJiNjYwMTQ5OTYzNDhiZXphdWJlcm5kc2lubmxpY2hlcnNjaHdhbkBtdWVsbC5pbw==', decrypted: 'bezauberndsinnlicherschwan@muell.io' },
    ]

    testCases.forEach(({ encrypted, decrypted }) => it('works', () => {
      expect(decrypt(encrypted)).toEqual(decrypted)
      expect(encrypt(decrypted)).toEqual(encrypted)
    }))
  })
})
