type Uniform = {
  name: string
  size: GLint
  type: string
  location: WebGLUniformLocation
  set: UniformSetter
}

export class Shader {
  private gl: WebGL2RenderingContext
  public program: WebGLProgram
  private uniforms: { [name: string]: Uniform }

  constructor(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
    this.gl = gl

    // compile the shader
    const program = linkProgram(
      gl,
      compileShader(gl, vertex, gl.VERTEX_SHADER),
      compileShader(gl, fragment, gl.FRAGMENT_SHADER),
    )
    this.program = program

    // reflect uniforms
    this.uniforms = {}
    this.bind()
    for (let i = 0, len = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS); i < len; ++i) {
      const info = gl.getActiveUniform(this.program, i)!
      const location = gl.getUniformLocation(program, info.name)!
      this.uniforms[info.name] = {
        name: info.name,
        size: info.size,
        type: stringifyType(info.type),
        location,
        set: createSetter(gl, info.type, location),
      }
    }
    this.unbind()
  }

  setUniform(name: string, data: number | number[]) {
    const uniform = this.uniforms[name]
    if (uniform === undefined) {
      throw new Error(`Cannot find uniform ${name}`)
    }
    uniform.set(data)
  }

  bind() {
    this.gl.useProgram(this.program)
  }

  unbind() {
    this.gl.useProgram(null)
  }

  destroy() {
    this.gl.deleteProgram(this.program)
    this.program = null!
    this.uniforms = null!
  }
}


/**
 * Builds a human-readable error message from a shader.
 *
 * This assumes that the shader has failed to compile, and has a non-null error log.
 */
function buildShaderErrorMessage(gl: WebGL2RenderingContext, shader: WebGLShader): string {
  const source = gl.getShaderSource(shader)
  const log = gl.getShaderInfoLog(shader)

  // if both sources are null, exit early
  if (source === null) {
    return `\n${log}\n`
  }
  if (log === null) {
    return `Unknown error`
  }
  // parse for line number and error
  const tokens = log
    .split('\n')
    .filter((it) => it.length > 1)
    .map((it) => it.replace(/(ERROR:\s)/g, ''))
    .map((it) => it.split(':'))
    .flat()
    .map((it) => it.trim())
  const [line, token, error] = [parseInt(tokens[1]), tokens[2], tokens[3]]
  const lines = source.split(/\n|\r/g)
  // pad first line - this always works
  // because the first line in a webgl shader MUST be a #version directive
  // and no whitespace characters may precede it
  lines[0] = `    ${lines[0]}`

  const padding = `${lines.length}`.length

  for (let i = 0; i < lines.length; ++i) {
    if (i === line - 1) {
      const whitespaces = lines[i].match(/\s+/)
      if (whitespaces !== null) {
        lines[i] = `${'-'.repeat(whitespaces[0].length - 1)}> ${lines[i].trimStart()}`
      }
      lines[i] = `${' '.repeat(padding - `${i + 1}`.length)}${i + 1} +${lines[i]}`
    } else {
      lines[i] = `${' '.repeat(padding - `${i + 1}`.length)}${i + 1} |  ${lines[i]}`
    }
  }
  lines.push(`${' '.repeat(padding)} |`)
  lines.push(`${' '.repeat(padding)} +-------> ${error}: ${token}`)
  lines.push(``)

  return lines.join('\n')
}

// it's possible to compile shaders in parallel, but i didn't bother including that
// as it's overkill for the tiny shader we're using here.
// if you had a more complex shader, or many variants of a shader which you generate
// at runtime, you'd definitely want to compile them in parallel.
function compileShader(gl: WebGL2RenderingContext, source: string, type: GLenum): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) === false) {
    throw new Error('\n' + buildShaderErrorMessage(gl, shader))
  }
  return shader
}

function linkProgram(
  gl: WebGL2RenderingContext,
  vertex: WebGLShader,
  fragment: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram()!
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)

  if (gl.getProgramParameter(program, /* LINK_STATUS */ 0x8b82) === false) {
    const log = gl.getProgramInfoLog(program)
    throw new Error(`Failed to link program: ${log}`)
  }
  return program
}


type UniformSetter = (data: number | number[]) => void


// this function is used to create a setter function for a uniform
// based on its type. it's a bit verbose, but it's the most efficient
// way to handle all uniform types generically in webgl, as the
// result is a simple function call with no branching.
function createSetter(
  gl: WebGL2RenderingContext,
  type: number,
  location: WebGLUniformLocation,
): UniformSetter {
  let typeInfo: [desc: 'scalar' | 'array' | 'matrix', size: number, name: string]
  switch (type) {
    case 0x1400:
    case 0x1402:
    case 0x1404:
    case 0x8b56:
    case 0x8b5e:
    case 0x8b5f:
    case 0x8b60:
    case 0x8dc1:
    case 0x8dd2:
      typeInfo = ['scalar', 1, 'uniform1i']
      break
    case 0x1401:
    case 0x1403:
    case 0x1405:
      typeInfo = ['scalar', 1, 'uniform1ui']
      break
    case 0x8b53:
    case 0x8b57:
      typeInfo = ['array', 2, 'uniform2iv']
      break
    case 0x8b54:
    case 0x8b58:
      typeInfo = ['array', 3, 'uniform3iv']
      break
    case 0x8b55:
    case 0x8b59:
      typeInfo = ['array', 4, 'uniform4iv']
      break
    case 0x1406:
      typeInfo = ['scalar', 1, 'uniform1f']
      break
    case 0x8b50:
      typeInfo = ['array', 2, 'uniform2fv']
      break
    case 0x8b51:
      typeInfo = ['array', 3, 'uniform3fv']
      break
    case 0x8b52:
      typeInfo = ['array', 4, 'uniform4fv']
      break
    case 0x8dc6:
      typeInfo = ['array', 2, 'uniform2uiv']
      break
    case 0x8dc7:
      typeInfo = ['array', 3, 'uniform3uiv']
      break
    case 0x8dc8:
      typeInfo = ['array', 4, 'uniform4uiv']
      break
    case 0x8b5a:
      typeInfo = ['matrix', 2 * 2, 'uniformMatrix2fv']
      break
    case 0x8b65:
      typeInfo = ['matrix', 2 * 3, 'uniformMatrix2x3fv']
      break
    case 0x8b66:
      typeInfo = ['matrix', 2 * 4, 'uniformMatrix2x4fv']
      break
    case 0x8b67:
      typeInfo = ['matrix', 3 * 2, 'uniformMatrix3x2fv']
      break
    case 0x8b5b:
      typeInfo = ['matrix', 3 * 3, 'uniformMatrix3fv']
      break
    case 0x8b68:
      typeInfo = ['matrix', 3 * 4, 'uniformMatrix3x4fv']
      break
    case 0x8b69:
      typeInfo = ['matrix', 4 * 2, 'uniformMatrix4x2fv']
      break
    case 0x8b6a:
      typeInfo = ['matrix', 4 * 3, 'uniformMatrix4x3fv']
      break
    case 0x8b5c:
      typeInfo = ['matrix', 4 * 4, 'uniformMatrix4fv']
      break
    default:
      throw new Error(`Unknown uniform type: ${type}`)
  }

  const setter = typeInfo[2]
  switch (typeInfo[0]) {
    case 'scalar': {
      // @ts-ignore
      const setterFn = gl[setter].bind(gl)
      return function (data) {
        // if (import.meta.env.DEV && typeof data !== 'number') {
        //   const dataType = Array.isArray(data) ? `${typeof data[0]}[${data.length}]` : typeof data
        //   throw new Error(`Invalid uniform data: expected ${stringifyType(type)}, got ${dataType}`)
        // }
        setterFn(location, data)
      }
    }
    case 'array': {
      // @ts-ignore
      const setterFn = gl[setter].bind(gl)
      return function (data) {
        // if (import.meta.env.DEV && (!Array.isArray(data) || data.length !== typeInfo[1])) {
        //   const dataType = Array.isArray(data) ? `${typeof data[0]}[${data.length}]` : typeof data
        //   throw new Error(`Invalid uniform data: expected ${stringifyType(type)}, got ${dataType}`)
        // }
        // @ts-ignore
        setterFn(location, data)
      }
    }
    case 'matrix': {
      // @ts-ignore
      const setterFn = gl[setter].bind(gl)
      return function (data) {
        // if (import.meta.env.DEV && (!Array.isArray(data) || data.length !== typeInfo[1])) {
        //   const dataType = Array.isArray(data) ? `${typeof data[0]}[${data.length}]` : typeof data
        //   throw new Error(`Invalid uniform data: expected ${stringifyType(type)}, got ${dataType}`)
        // }
        // @ts-ignore
        setterFn(location, false, data)
      }
    }
    default: {
      throw new Error(`Unknown uniform type: ${typeInfo[0]}`)
    }
  }
}


function stringifyType(type: number): string {
  switch (type) {
    case 0x1400:
      return 'byte'
    case 0x1402:
      return 'short'
    case 0x1404:
      return 'int'
    case 0x8b56:
      return 'bool'
    case 0x8b5e:
      return '2d float sampler'
    case 0x8b5f:
      return '3d float sampler'
    case 0x8dc1:
      return '2d float sampler array'
    case 0x8dd2:
      return '2d unsigned int sampler'
    case 0x8b60:
      return 'cube sampler'
    case 0x1401:
      return 'unsigned byte'
    case 0x1403:
      return 'unsigned short'
    case 0x1405:
      return 'unsigned int'
    case 0x8b53:
      return 'int 2-component vector'
    case 0x8b54:
      return 'int 3-component vector'
    case 0x8b55:
      return 'int 4-component vector'
    case 0x8b57:
      return 'bool 2-component vector'
    case 0x8b58:
      return 'bool 3-component vector'
    case 0x8b59:
      return 'bool 4-component vector'
    case 0x1406:
      return 'float'
    case 0x8b50:
      return 'float 2-component vector'
    case 0x8b51:
      return 'float 3-component vector'
    case 0x8b52:
      return 'float 4-component vector'
    case 0x8dc6:
      return 'unsigned int 2-component vector'
    case 0x8dc7:
      return 'unsigned int 3-component vector'
    case 0x8dc8:
      return 'unsigned int 4-component vector'
    case 0x8b5a:
      return 'float 2x2 matrix'
    case 0x8b65:
      return 'float 2x3 matrix'
    case 0x8b66:
      return 'float 2x4 matrix'
    case 0x8b5b:
      return 'float 3x3 matrix'
    case 0x8b67:
      return 'float 3x2 matrix'
    case 0x8b68:
      return 'float 3x4 matrix'
    case 0x8b5c:
      return 'float 4x4 matrix'
    case 0x8b69:
      return 'float 4x2 matrix'
    case 0x8b6a:
      return 'float 4x3 matrix'
    default:
      throw new Error(`Unknown uniform type: ${type}`)
  }
}
