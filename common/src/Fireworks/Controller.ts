import { Rng } from '../Rng'
import { Bomb } from './Bomb'
import { defaultOptions, Options } from './Options'
import { Particle } from './Particle'

export class Controller {
  public tick: number = 0

  public readyBombs: Bomb[] = []
  public explodedBombs: Bomb[] = []
  public particles: Particle[] = []

  constructor(
    public readonly rng: Rng,
    public readonly options: Options = defaultOptions(),
  ) {
  }

  public init() {
    this.readyBombs.push(new Bomb(this))
  }

  public doTick() {
    this.tick++
  }

  public updateSizeParams(canvas: HTMLCanvasElement | OffscreenCanvas) {
    let heightReached = 0
    let vy = 0

    while (heightReached < canvas.height && vy >= 0) {
      vy += 1
      heightReached += vy
    }

    this.options.minVy = vy / 2
    this.options.deltaVy = vy - this.options.minVy

    const vx = (1 / 4) * canvas.width / (vy / 2)
    this.options.minVx = -vx
    this.options.deltaVx = 2 * vx
  }

  public update() {
    if (this.rng.random(0, 100) < this.options.percentChanceNewBomb) {
      this.readyBombs.push(new Bomb(this))
    }

    const aliveBombs = []
    while (this.explodedBombs.length > 0) {
      const bomb = this.explodedBombs.shift()
      if (!bomb) {
        break
      }
      bomb.update()
      if (bomb.alive) {
        aliveBombs.push(bomb)
      }
    }
    this.explodedBombs = aliveBombs

    const notExplodedBombs = []
    while (this.readyBombs.length > 0) {
      const bomb = this.readyBombs.shift()
      if (!bomb) {
        break
      }
      bomb.update(this.particles)
      if (bomb.hasExploded) {
        this.explodedBombs.push(bomb)
      }
      else {
        notExplodedBombs.push(bomb)
      }
    }
    this.readyBombs = notExplodedBombs

    const aliveParticles = []
    while (this.particles.length > 0) {
      const particle = this.particles.shift()
      if (!particle) {
        break
      }
      particle.update()
      if (particle.alive) {
        aliveParticles.push(particle)
      }
    }
    this.particles = aliveParticles
  }

  public getWebglArray(): number[] {
    const newData = []
    for (const bomb of this.explodedBombs) {
      if (bomb.alive && !bomb.hasExploded) {
        newData.push(...bomb.getWebglArray())
      }
    }
    for (const bomb of this.readyBombs) {
      if (bomb.alive && !bomb.hasExploded) {
        newData.push(...bomb.getWebglArray())
      }
    }
    for (const particle of this.particles) {
      if (particle.alive) {
        newData.push(...particle.getWebglArray())
      }
    }
    return newData
  }

  public render(ctx: CanvasRenderingContext2D) {
    for (const bomb of this.explodedBombs) {
      if (bomb.alive && !bomb.hasExploded && bomb.draw) {
        bomb.draw(ctx)
      }
    }
    for (const bomb of this.readyBombs) {
      if (bomb.alive && !bomb.hasExploded && bomb.draw) {
        bomb.draw(ctx)
      }
    }
    for (const particle of this.particles) {
      if (particle.alive && particle.draw) {
        particle.draw(ctx)
      }
    }
  }
}
