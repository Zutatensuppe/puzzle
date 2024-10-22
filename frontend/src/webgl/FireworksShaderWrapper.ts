import { Controller } from '../../../common/src/Fireworks/Controller'
import { Rng } from '../Rng'
import { Shader } from './Shader'
import fireworksFragment from './shaders/fireworksFragment'
import fireworksVertex from './shaders/fireworksVertex'

export class FireworksShaderWrapper {
  private shader!: Shader
  private vao: WebGLVertexArrayObject | null = null

  private positionLocation!: GLint
  private dataAttribLoc!: GLint
  private dataBuffer!: WebGLBuffer

  private vertices!: Float32Array

  private fireworksController: Controller

  constructor(
    private readonly gl: WebGL2RenderingContext,
    rng: Rng,
  ) {
    this.fireworksController = new Controller(rng)
  }

  public init() {
    this.fireworksController.init()

    // Initialize the shader program with the new vertex and fragment shaders
    this.shader = new Shader(this.gl, fireworksVertex, fireworksFragment)
    this.shader.bind()

    // Create VAO for a full-screen quad
    this.vao = this.gl.createVertexArray()
    this.gl.bindVertexArray(this.vao)
    this.vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    const vertexBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertices, this.gl.STATIC_DRAW)

    this.positionLocation = this.gl.getAttribLocation(this.shader.program, 'position')
    this.gl.enableVertexAttribArray(this.positionLocation)
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0)
    this.gl.disableVertexAttribArray(this.positionLocation)

    this.dataAttribLoc = this.gl.getAttribLocation(this.shader.program, 'a_data')
    this.dataBuffer = this.gl.createBuffer()!
    this.gl.enableVertexAttribArray(this.dataAttribLoc)
    this.gl.vertexAttribPointer(this.dataAttribLoc, 4, this.gl.FLOAT, false, 0, 0)
    this.gl.disableVertexAttribArray(this.dataAttribLoc)

    this.shader.setUniform('u_res', [this.gl.canvas.width, this.gl.canvas.height])
  }

  public render() {
    if (!this.vao || !this.shader.program) {
      console.error('Shader or WebGL objects not initialized!')
      return
    }

    // Bind shader and VAO
    this.shader.bind()
    this.gl.bindVertexArray(this.vao)
    this.shader.setUniform('u_res', [this.gl.canvas.width, this.gl.canvas.height])

    this.fireworksController.doTick()
    this.fireworksController.updateSizeParams(this.gl.canvas)
    this.fireworksController.update()

    // Render full-screen quad
    this.shader.setUniform('u_mode', 1)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.dataBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertices, this.gl.STATIC_DRAW)
    this.gl.enableVertexAttribArray(this.positionLocation)
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
    this.gl.disableVertexAttribArray(this.positionLocation)

    // Render fireworks points
    this.shader.setUniform('u_mode', 0)
    const data = this.fireworksController.getWebglArray()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.dataBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.STATIC_DRAW)
    this.gl.enableVertexAttribArray(this.dataAttribLoc)
    this.gl.vertexAttribPointer(this.dataAttribLoc, 4, this.gl.FLOAT, false, 0, 0)
    this.gl.drawArrays(this.gl.POINTS, 0, data.length / 4)
    this.gl.disableVertexAttribArray(this.dataAttribLoc)
  }
}
