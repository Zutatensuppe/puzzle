import Util from './../common/Util.js'

let minVx = -10
let deltaVx = 20
let minVy = 2
let deltaVy = 15
const minParticleV = 5
const deltaParticleV = 5

const gravity = 1

const explosionRadius = 200
const bombRadius = 10
const explodingDuration = 100
const explosionDividerFactor = 10

const nBombs = 1
const percentChanceNewBomb = 5

function color() {
  const r = Util.randomInt(0, 255)
  const g = Util.randomInt(0, 255)
  const b = Util.randomInt(0, 255)
  return 'rgba(' + r + ',' + g + ',' + b + ', 0.8)'
}

// A Bomb. Or firework.
class Bomb {
  constructor() {
    this.radius = bombRadius
    this.previousRadius = bombRadius
    this.explodingDuration = explodingDuration
    this.hasExploded = false
    this.alive = true
    this.color = color()

    this.px = (window.innerWidth / 4) + (Math.random() * window.innerWidth / 2)
    this.py = window.innerHeight

    this.vx = minVx + Math.random() * deltaVx
    this.vy = (minVy + Math.random() * deltaVy) * -1 // because y grows downwards

    this.duration = 0
  }

  update(particlesVector) {
    if (this.hasExploded) {
      const deltaRadius = explosionRadius - this.radius
      this.previousRadius = this.radius
      this.radius += deltaRadius / explosionDividerFactor
      this.explodingDuration--
      if (this.explodingDuration == 0) {
        this.alive = false
      }
    }
    else {
      this.vx += 0
      this.vy += gravity
      if (this.vy >= 0) { // invertion point
        this.explode(particlesVector)
      }

      this.px += this.vx
      this.py += this.vy
    }
  }

  draw(ctx) {
    ctx.beginPath()
    ctx.arc(this.px, this.py, this.previousRadius, 0, Math.PI * 2, false)
    if (!this.hasExploded) {
      ctx.fillStyle = this.color
      ctx.lineWidth = 1
      ctx.fill()
    }
  }

  explode(particlesVector) {
    this.hasExploded = true
    const e = 3 + Math.floor(Math.random() * 3)
    for (let j = 0; j < e; j++) {
      const n = 10 + Math.floor(Math.random() * 21) // 10 - 30
      const speed = minParticleV + Math.random() * deltaParticleV
      const deltaAngle = 2 * Math.PI / n
      const initialAngle = Math.random() * deltaAngle
      for (let i = 0; i < n; i++) {
        particlesVector.push(new Particle(this, i * deltaAngle + initialAngle, speed))
      }
    }
  }
}

class Particle {
  constructor(parent, angle, speed) {
    this.px = parent.px
    this.py = parent.py
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed
    this.color = parent.color
    this.duration = 40 + Math.floor(Math.random() * 20)
    this.alive = true
  }
  update() {
    this.vx += 0
    this.vy += gravity / 10

    this.px += this.vx
    this.py += this.vy
    this.radius = 3

    this.duration--
    if (this.duration <= 0) {
      this.alive = false
    }
  }

  draw(ctx) {
    ctx.beginPath()
    ctx.arc(this.px, this.py, this.radius, 0, Math.PI * 2, false)
    ctx.fillStyle = this.color
    ctx.lineWidth = 1
    ctx.fill()
  }
}

class Controller {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = this.canvas.getContext('2d')
    this.resize()

    window.addEventListener('resize', () => {
      this.resize()
    })
  }

  setSpeedParams() {
    let heightReached = 0
    let vy = 0

    while (heightReached < this.canvas.height && vy >= 0) {
      vy += gravity
      heightReached += vy
    }

    minVy = vy / 2
    deltaVy = vy - minVy

    const vx = (1 / 4) * this.canvas.width / (vy / 2)
    minVx = -vx
    deltaVx = 2 * vx
  }

  resize() {
    this.setSpeedParams()
  }

  init() {
    this.readyBombs = []
    this.explodedBombs = []
    this.particles = []

    for (let i = 0; i < nBombs; i++) {
      this.readyBombs.push(new Bomb())
    }
  }

  update() {
    if (Math.random() * 100 < percentChanceNewBomb) {
      this.readyBombs.push(new Bomb())
    }

    const aliveBombs = []
    while (this.explodedBombs.length > 0) {
      const bomb = this.explodedBombs.shift()
      bomb.update()
      if (bomb.alive) {
        aliveBombs.push(bomb)
      }
    }
    this.explodedBombs = aliveBombs

    const notExplodedBombs = []
    while (this.readyBombs.length > 0) {
      const bomb = this.readyBombs.shift()
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
      particle.update()
      if (particle.alive) {
        aliveParticles.push(particle)
      }
    }
    this.particles = aliveParticles
  }

  render() {
    this.ctx.beginPath()
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)' // Ghostly effect
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    for (let i = 0; i < this.readyBombs.length; i++) {
      this.readyBombs[i].draw(this.ctx)
    }

    for (let i = 0; i < this.explodedBombs.length; i++) {
      this.explodedBombs[i].draw(this.ctx)
    }

    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].draw(this.ctx)
    }
  }
}

export default Controller
