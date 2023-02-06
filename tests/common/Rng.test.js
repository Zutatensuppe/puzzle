import { Rng } from '../../src/common/Rng'
import { expect, it } from 'vitest'

it('random should give same results', () => {
  const rng = new Rng(1337)
  const rng2 = new Rng(1337)
  for (let i = 0; i < 100; i++) {
    expect(rng.random()).toBe(rng2.random())
  }
})

it('should be serializable/deserializable', () => {
  const rng = new Rng(1337)
  // do some randoms, so that it doesnt start at 'after init'
  for (let i = 0; i < 100; i++) {
    rng.random()
  }

  const rng2 = Rng.unserialize(Rng.serialize(rng))

  for (let i = 0; i < 100; i++) {
    expect(rng.random()).toBe(rng2.random())
  }
})
