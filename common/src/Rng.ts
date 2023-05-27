export interface RngSerialized {
  rand_high: number,
  rand_low: number,
}

export class Rng {
  rand_high: number
  rand_low: number

  constructor(seed: number) {
    this.rand_high = seed || 0xDEADC0DE
    this.rand_low = seed ^ 0x49616E42
  }

  random (min: number, max: number): number {
    this.rand_high = ((this.rand_high << 16) + (this.rand_high >> 16) + this.rand_low) & 0xffffffff
    this.rand_low = (this.rand_low + this.rand_high) & 0xffffffff
    const n = (this.rand_high >>> 0) / 0xffffffff
    return (min + n * (max-min+1))|0
  }

  // get one random item from the given array
  choice<T> (array: Array<T>): T {
    return array[this.random(0, array.length - 1)]
  }

  // return a shuffled (shallow) copy of the given array
  shuffle<T> (array: Array<T>): Array<T> {
    const arr = array.slice()
    for (let i = 0; i <= arr.length - 2; i++) {
      const j = this.random(i, arr.length -1)
      const tmp = arr[i]
      arr[i] = arr[j]
      arr[j] = tmp
    }
    return arr
  }

  static serialize (rng: Rng): RngSerialized {
    return {
      rand_high: rng.rand_high,
      rand_low: rng.rand_low,
    }
  }

  static unserialize (rngSerialized: RngSerialized): Rng {
    const rng = new Rng(0)
    rng.rand_high = rngSerialized.rand_high
    rng.rand_low = rngSerialized.rand_low
    return rng
  }
}
