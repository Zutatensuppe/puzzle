export default /*glsl*/`#version 300 es
precision highp float;

uniform sampler2D u_texture0;
uniform sampler2D u_texture1;
in vec2 v_texCoord;
uniform vec2 u_texScale;

uniform vec4 u_color;
uniform int u_isDark;
uniform int u_showTable;
uniform int u_showPuzzleBackground;
uniform vec4 u_innerRect;
uniform vec4 u_puzzleFinalRect;
uniform vec4 u_puzzleFinalRectBorder;

uniform int u_showPreview;
uniform vec2 u_previewDim;

out vec4 fragColor;

bool is_point_in_box(vec2 point, vec4 box) {
  if (point.x >= box.x && point.x <= box.z && point.y >= box.y && point.y <= box.w) {
    return false;
  }
  return true;
}

void main() {
  vec4 bgColor = vec4(.0);
  if (u_showTable == 1) {
    bgColor = texture(u_texture0, v_texCoord / u_texScale);
  } else {
    bgColor = u_color;
  }

  vec4 tmpColor;
  if (u_showTable == 1 && is_point_in_box(v_texCoord, u_innerRect)) {
    // TABLE AREA
    vec4 borderOverlayColor = vec4(0.0, 0.0, 0.0, 0.5);
    tmpColor = mix(bgColor, borderOverlayColor, borderOverlayColor.a);
  } else if (is_point_in_box(v_texCoord, u_puzzleFinalRectBorder)) {
    // TABLE AREA (INSIDE OF TABLE BORDER)
    tmpColor = bgColor;
  } else if (is_point_in_box(v_texCoord, u_puzzleFinalRect)) {
    // BORDER AROUND THE FINAL RECTANGLE
    vec4 borderOverlayColor = vec4(0.0, 0.0, 0.0, 0.5);
    tmpColor = mix(bgColor, borderOverlayColor, borderOverlayColor.a);
  } else {
    // AREA INSIDE THE FINAL RECTANGLE
    if (u_showPuzzleBackground == 0) {
      tmpColor = bgColor;
    } else if (u_showPreview == 1) {
      vec4 previewColor = texture(u_texture1, (v_texCoord - vec2(u_puzzleFinalRect)) / u_previewDim);
      // preview to greyscale:
      float avg = (previewColor.r + previewColor.g + previewColor.b) / 3.0;
      tmpColor = mix(vec4(0.0, 0.0, 0.0, 1.0), vec4(avg), 0.3);
    } else {
      vec4 innerOverlayColor = vec4(0.0, 0.0, 0.0, 0.3);
      if (u_isDark == 0) {
        innerOverlayColor = vec4(1.0, 1.0, 1.0, 0.3);
      }
      tmpColor = mix(bgColor, innerOverlayColor, innerOverlayColor.a);
    }
  }

  fragColor = vec4(tmpColor.rgb, bgColor.a);
}
`
