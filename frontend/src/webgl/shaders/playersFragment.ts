export default /*glsl*/`#version 300 es
precision highp float;

in vec2 v_texcoord;

out vec4 fragColor;

uniform sampler2D u_texture;

// when u_isUkraine is 1, the mask color is replaced with the colors of the Ukrainian flag
// otherwise the mask color is replaced with u_color
uniform int u_isUkraine;
uniform vec4 u_color;

bool is_magenta(vec4 color) {
  return color.r == 1.0 && color.g == 0.0 && color.b == 1.0;
}

vec4 determine_frag_color() {
  vec4 color = texture(u_texture, v_texcoord);
  // magenta is the mask color
  if (!is_magenta(color)) {
    return color;
  }

  if (u_isUkraine == 1) {
    vec4 color1 = vec4(0., 0.341, 0.718, 1); // 0057B7
    vec4 color2 = vec4(1., 0.867, 0., 1); // FFDD00
    // a bit more than half looks just about right
    if (v_texcoord.y < 0.57) {
      return color1;
    }
    return color2;
  }
  return vec4(u_color.rgb, 1);
}

void main() {
  fragColor = determine_frag_color();
}
`
