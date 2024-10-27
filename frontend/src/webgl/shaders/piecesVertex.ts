export default /*glsl*/`#version 300 es
precision highp float;

uniform mat4 projection;
uniform mat4 view;

layout(location = 0) in vec2 position;
layout(location = 1) in vec2 texcoord;

layout(location = 2) in uint tid;
layout(location = 3) in float x; // world space
layout(location = 4) in float y; // world space
layout(location = 5) in float z; // z index

layout(location = 6) in float t_x; // texture pos (on puzzle image)
layout(location = 7) in float t_y; // texture pos (on puzzle image)

layout(location = 8) in uint rotation; // rotation of piece
layout(location = 9) in uint visible; // visibility of piece

flat out uint v_tid;
flat out uint v_rotation;
flat out uint v_visible;
out vec2 v_texcoord;
out vec2 v_puzcoord;

// TODO: replace hardcoded values (build shader with a template string?)
const float SPRITE_SIZE = 64.0;
const float PADDING_SIZE = 32.0;

void main() {
    v_tid = tid;
    v_rotation = rotation;
    v_visible = visible;
    v_texcoord = texcoord;
    v_puzcoord = vec2(t_x, t_y);

    mat4 model = mat4(
      SPRITE_SIZE + PADDING_SIZE * 2.0, 0, 0, 0,
      0, SPRITE_SIZE + PADDING_SIZE * 2.0, 0, 0,
      0, 0, 1, 0,
      x + PADDING_SIZE, y + PADDING_SIZE, 0, 1
    );
    mat4 rotationMatrix = mat4(
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    );
    if (rotation == 1u) {
      // 90 deg
      rotationMatrix = mat4(
        0, 1, 0, 0,
        -1, 0, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      );
    } else if (rotation == 2u) {
      // 180 deg
      rotationMatrix = mat4(
        -1, 0, 0, 0,
        0, -1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      );
    } else if (rotation == 3u) {
      // 270 deg
      rotationMatrix = mat4(
        0, -1, 0, 0,
        1, 0, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      );
    }

    gl_Position = projection * view * model * rotationMatrix * vec4(position, z, 1);
}
`
