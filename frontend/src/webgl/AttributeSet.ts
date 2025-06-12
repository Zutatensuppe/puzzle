import type { Buffer, BufferType } from './Buffer'

/**
 * Describes a set of attributes to be bound to a VAO.
 */
interface AttributeArrayDescriptor {
  /** Buffer to bind the given attributes to */
  buffer: Buffer<BufferType>
  attributes: AttributeDescriptor[]
}

/**
 * Describes a single attribute to be bound to a VAO.
 */
interface AttributeDescriptor {
  /**
   * Attribute index
   *
   * e.g. for attribute `layout(location = 0) in vec2 POSITION` it would be `0`.
   */
  location: number

  /**
   * Number of `baseType` in the compound type.
   *
   * e.g. for attribute `layout(location = 0) in vec2 POSITION`, it would be `2`, because it's a `vec2`.
   */
  arraySize: number

  /**
   * Base type of the attribute
   *
   * e.g. for attribute `layout(location = 0) in vec2 POSITION`, it would be `GL.FLOAT`, because it's a `vec2`, which is comprised of two floats.
   */
  baseType: GLenum

  /**
   * Whether the value should be normalized to the (0, 1) range.
   *
   * Ignored for integer types.
   */
  normalized: boolean

  /**
   * The divisor for instanced rendering.
   *
   * If `0`, the attribute is advanced for each vertex.
   * If `1`, the attribute is advanced for each instance.
   * If `N>1`, the attribute is advanced for every `N` instances.
   *
   * This allows you to for example set the texture ID for each instance separately,
   * while sharing the same base geometry.
   */
  divisor: number
}

export function floatAttrib(location: number, divisor: number = 0): AttributeDescriptor {
  return { location, arraySize: 1, baseType: FloatT, normalized: false, divisor }
}

export function vec2Attrib(location: number, divisor: number = 0): AttributeDescriptor {
  return { location, arraySize: 2, baseType: FloatT, normalized: false, divisor }
}

// Note: For some types like `uint`, the data can actually be stored using
//       smaller bit widths, like `ubyte` or `ushort`.
//       for integer types, the GPU sign-extends the value to 32-bits.

export function ubyteAttrib(location: number, divisor: number = 0): AttributeDescriptor {
  return { location, arraySize: 1, baseType: UnsignedByteT, normalized: false, divisor }
}

const ByteT = 0x1400
const UnsignedByteT = 0x1401
const ShortT = 0x1402
const UnsignedShortT = 0x1403
const IntT = 0x1404
const UnsignedIntT = 0x1405
const FloatT = 0x1406

/**
 * Returns the size in bytes of the given base type.
 */
function attribSizeOf(type: GLenum) {
  switch (type) {
    case ByteT:
    case UnsignedByteT:
      return 1
    case ShortT:
    case UnsignedShortT:
      return 2
    case IntT:
    case UnsignedIntT:
    case FloatT:
      return 4
    default:
      throw new Error(`Unknown base type: ${type}`)
  }
}

/**
 * Returns whether the given base type is an integer type.
 *
 * This is used to determine if integer pointers should be used over floating point pointers.
 *
 * The difference between the two is that the GPU reads integers as-is, but floating point
 * values may be normalized if requested.
 *
 * You _could_ pass integer data to a floating point pointer, but the GPU would interpret it as
 * a floating point value, which may not be what you want.
 */
function attribIsInt(type: GLenum) {
  switch (type) {
    case ByteT:
    case UnsignedByteT:
    case ShortT:
    case UnsignedShortT:
    case IntT:
    case UnsignedIntT:
      return true
    default:
      return false
  }
}

/**
 * A set of attributes to be bound to a VAO.
 */
export class AttributeSet {
  gl: WebGL2RenderingContext
  vao: WebGLVertexArrayObject

  constructor(gl: WebGL2RenderingContext, descriptors: AttributeArrayDescriptor[]) {
    this.gl = gl
    this.vao = gl.createVertexArray()!

    if (descriptors.length === 0) {
      throw new Error('No descriptors provided')
    }

    gl.bindVertexArray(this.vao)

    for (const descriptor of descriptors) {
      // calculate stride
      let stride = 0
      for (const attribute of descriptor.attributes) {
        stride += attribSizeOf(attribute.baseType) * attribute.arraySize
      }

      descriptor.buffer.bind()

      // for each attribute, bind it to the VAO, and set the pointer
      let offset = 0
      for (const attribute of descriptor.attributes) {
        gl.enableVertexAttribArray(attribute.location)
        if (attribIsInt(attribute.baseType)) {
          gl.vertexAttribIPointer(
            attribute.location,
            attribute.arraySize,
            attribute.baseType,
            stride,
            offset,
          )
        } else {
          gl.vertexAttribPointer(
            attribute.location,
            attribute.arraySize,
            attribute.baseType,
            attribute.normalized,
            stride,
            offset,
          )
        }

        // if the attribute is instanced, set the divisor
        if (attribute.divisor !== 0) {
          gl.vertexAttribDivisor(attribute.location, attribute.divisor)
        }

        offset += attribSizeOf(attribute.baseType) * attribute.arraySize
      }

      descriptor.buffer.unbind()
    }

    gl.bindVertexArray(null)
  }

  bind() {
    this.gl.bindVertexArray(this.vao)
  }

  unbind() {
    this.gl.bindVertexArray(null)
  }

  destroy() {
    this.gl.deleteVertexArray(this.vao)
  }
}

