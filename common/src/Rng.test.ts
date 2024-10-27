import { Rng } from './Rng'
import { describe, expect, it } from 'vitest'

describe('Rng.ts', () => {
  it('random should give same results', () => {
    const rng = new Rng(1337)
    const rng2 = new Rng(1337)
    for (let i = 0; i < 100; i++) {
      expect(rng.random(0, 20)).toBe(rng2.random(0, 20))
    }
  })

  it('should be serializable/deserializable', () => {
    const rng = new Rng(1337)
    // do some randoms, so that it doesnt start at 'after init'
    for (let i = 0; i < 100; i++) {
      rng.random(0, 20)
    }

    const rng2 = Rng.unserialize(Rng.serialize(rng))

    for (let i = 0; i < 100; i++) {
      expect(rng.random(0, 20)).toBe(rng2.random(0, 20))
    }
  })
})
