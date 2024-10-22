export default /*glsl*/`#version 300 es
precision highp float;

in vec4 a_position;
in vec2 a_texCoord;

uniform mat4 u_matrix;

out vec2 v_texCoord;

void main() {
  gl_Position = u_matrix * a_position;
  v_texCoord = a_texCoord;
}
`
