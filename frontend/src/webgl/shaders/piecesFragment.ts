export default /*glsl*/`#version 300 es
precision highp float;

uniform highp sampler2DArray atlas;
uniform highp sampler2D atlas2;
uniform vec2 puzzle_image_size;

flat in uint v_tid;
in vec2 v_texcoord;
in vec2 v_puzcoord;

out vec4 fragColor;

// TODO: replace hardcoded values (build shader with a template string?)
const float SPRITE_SIZE = 64.0;
const float PADDING_SIZE = 32.0;
const float FULL_SIZE = SPRITE_SIZE + 2.0 * PADDING_SIZE;
const vec2 PIECE_SIZE = vec2(SPRITE_SIZE, SPRITE_SIZE);

vec3 blendLightenDarken(vec3 baseColor, vec4 gradient) {
  // gradient.rgb is the grayscale color from gradient texture
  // gradient.a is the alpha, which determines how much to blend

  vec3 result = baseColor;

  // If gradient is more white (closer to 1.0), lighten the base color
  result = mix(result, vec3(1.0), gradient.r * gradient.a * 1.3);

  // If gradient is more black (closer to 0.0), darken the base color
  result = mix(result, vec3(0.0), (1.0 - gradient.r) * gradient.a * .3);

  // Ensure the color remains in valid RGB range [0.0, 1.0]
  return clamp(result, 0.0, 1.0);
}

vec4 determine_frag_color() {
  // Map texcoord to the stencil texture, correcting for the actual size
  vec2 adjustedTexcoord = v_texcoord;

  // Calculate the position in the puzzle image
  vec2 puzzleCoord = v_puzcoord + v_texcoord * (PIECE_SIZE + 2.0 *PADDING_SIZE) - PADDING_SIZE;
  puzzleCoord /= puzzle_image_size; // Normalize to [0, 1] range

  // Sample the stencil and puzzle image
  vec4 stencil = texture(atlas, vec3(adjustedTexcoord, float(v_tid)));
  vec4 puzzleImage = texture(atlas2, puzzleCoord);

  // Determine the final color before blur
  vec4 col = vec4(.0);
  if (stencil.r >=.9 && stencil.b >= .9) {
    // magenta is transparent
    col = vec4(.0);
  } else {
    col = vec4(blendLightenDarken(puzzleImage.rgb, stencil), 1.0);
  }
  return col;
}

void main() {
  fragColor = determine_frag_color();
}
`
