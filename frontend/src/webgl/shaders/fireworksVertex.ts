export default /*glsl*/`#version 300 es

precision mediump float;

uniform highp int u_mode;
uniform vec2 u_res;

in vec2 position;
in vec4 a_data;

out vec4 v_color;

vec3 hueToRgb( float h ) {
	return clamp(abs(mod(h * 6. + vec3(0, 4, 2), 6.) - 3.) -1., 0., 1.);
}

void main(){
  if (u_mode == 0) {
    gl_PointSize = a_data.w * 2.0;
    gl_Position = vec4(vec2(1, -1) * ((a_data.xy / u_res) * 2. - 1.), -1.0, 1);
    v_color = vec4(hueToRgb(a_data.z), 0.8);
  } else {
    gl_Position = vec4(position, -.8, 1);
  }
}
`
