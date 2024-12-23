type Matrix4 = any

function orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number, dst: Matrix4 | undefined) {
  dst = dst || new Float32Array(16)

  dst[ 0] = 2 / (right - left)
  dst[ 1] = 0
  dst[ 2] = 0
  dst[ 3] = 0
  dst[ 4] = 0
  dst[ 5] = 2 / (top - bottom)
  dst[ 6] = 0
  dst[ 7] = 0
  dst[ 8] = 0
  dst[ 9] = 0
  dst[10] = 2 / (near - far)
  dst[11] = 0
  dst[12] = (left + right) / (left - right)
  dst[13] = (bottom + top) / (bottom - top)
  dst[14] = (near + far) / (near - far)
  dst[15] = 1

  return dst
}

function translate(m: Matrix4, tx: number, ty: number, tz: number, dst: Matrix4 | undefined) {
  dst = dst || new Float32Array(16)

  const m00 = m[0]
  const m01 = m[1]
  const m02 = m[2]
  const m03 = m[3]
  const m10 = m[1 * 4 + 0]
  const m11 = m[1 * 4 + 1]
  const m12 = m[1 * 4 + 2]
  const m13 = m[1 * 4 + 3]
  const m20 = m[2 * 4 + 0]
  const m21 = m[2 * 4 + 1]
  const m22 = m[2 * 4 + 2]
  const m23 = m[2 * 4 + 3]
  const m30 = m[3 * 4 + 0]
  const m31 = m[3 * 4 + 1]
  const m32 = m[3 * 4 + 2]
  const m33 = m[3 * 4 + 3]

  if (m !== dst) {
    dst[ 0] = m00
    dst[ 1] = m01
    dst[ 2] = m02
    dst[ 3] = m03
    dst[ 4] = m10
    dst[ 5] = m11
    dst[ 6] = m12
    dst[ 7] = m13
    dst[ 8] = m20
    dst[ 9] = m21
    dst[10] = m22
    dst[11] = m23
  }

  dst[12] = m00 * tx + m10 * ty + m20 * tz + m30
  dst[13] = m01 * tx + m11 * ty + m21 * tz + m31
  dst[14] = m02 * tx + m12 * ty + m22 * tz + m32
  dst[15] = m03 * tx + m13 * ty + m23 * tz + m33

  return dst
}

function scale(m: Matrix4, sx: number, sy: number, sz: number, dst: Matrix4 | undefined) {
  dst = dst || new Float32Array(16)

  dst[ 0] = sx * m[0 * 4 + 0]
  dst[ 1] = sx * m[0 * 4 + 1]
  dst[ 2] = sx * m[0 * 4 + 2]
  dst[ 3] = sx * m[0 * 4 + 3]
  dst[ 4] = sy * m[1 * 4 + 0]
  dst[ 5] = sy * m[1 * 4 + 1]
  dst[ 6] = sy * m[1 * 4 + 2]
  dst[ 7] = sy * m[1 * 4 + 3]
  dst[ 8] = sz * m[2 * 4 + 0]
  dst[ 9] = sz * m[2 * 4 + 1]
  dst[10] = sz * m[2 * 4 + 2]
  dst[11] = sz * m[2 * 4 + 3]

  if (m !== dst) {
    dst[12] = m[12]
    dst[13] = m[13]
    dst[14] = m[14]
    dst[15] = m[15]
  }

  return dst
}

export default {
  orthographic,
  translate,
  scale,
}

