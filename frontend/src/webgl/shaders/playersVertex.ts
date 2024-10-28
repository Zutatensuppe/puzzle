export default /*glsl*/`#version 300 es
in vec2 a_position;
in vec2 a_texcoord;

uniform mat4 u_matrix;

out vec2 v_texcoord;

void main() {
   gl_Position = u_matrix * vec4(a_position, 1, 1);
   v_texcoord = a_texcoord;
}
`
