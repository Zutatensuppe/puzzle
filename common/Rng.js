export class Rng {
  constructor(seed) {
    this.rand_high = seed || 0xDEADC0DE
    this.rand_low = seed ^ 0x49616E42
  }

  random (min, max) {
    this.rand_high = ((this.rand_high << 16) + (this.rand_high >> 16) + this.rand_low) & 0xffffffff;
    this.rand_low = (this.rand_low + this.rand_high) & 0xffffffff;
    var n = (this.rand_high >>> 0) / 0xffffffff;
    return (min + n * (max-min+1))|0;
  }

  static serialize (rng) {
    return {
      rand_high: rng.rand_high,
      rand_low: rng.rand_low
    }
  }

  static unserialize (rngSerialized) {
    const rng = new Rng(0)
    rng.rand_high = rngSerialized.rand_high
    rng.rand_low = rngSerialized.rand_low
    return rng
  }
}
