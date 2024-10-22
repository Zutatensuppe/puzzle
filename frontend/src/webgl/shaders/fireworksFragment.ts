export default /*glsl*/`#version 300 es

precision mediump float;

uniform highp int u_mode;

in vec4 v_color;

out vec4 fragColor;

void main() {
  if (u_mode == 0) {
    vec2 circCoord = 2.0 * gl_PointCoord - 1.0;
    float dist = dot(circCoord, circCoord);
    if (dist > 1.0) {
      fragColor = vec4(0.0);
    } else {
      fragColor = v_color;
    }
  } else {
    fragColor = vec4(.0, 0., 0., .2);
  }
}
`
