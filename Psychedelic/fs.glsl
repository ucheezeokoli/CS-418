#version 300 es
precision highp float;

in vec2 v_Position;  // Position from the vertex shader (interpolated across the triangle)
uniform float seconds;  // Uniform value for the time since animation began

out vec4 fragColor;  // Output color of each fragment

void main() {
    // Normalize the fragment position to be in the range [-1, 1] to [0, 1]
    vec2 uv = v_Position * 0.5 + 0.5;

    // Use a combination of trigonometric and polynomial functions to create a pattern
    float pattern = sin(uv.x * 10.0 + seconds) * cos(uv.y * 10.0 + seconds);
    pattern += cos(uv.x * uv.y * 20.0 + seconds) * sin(uv.x * uv.y * 15.0 + seconds);

    // Generate color based on the pattern
    vec3 color = vec3(0.5 + 0.5 * sin(seconds + uv.x * 5.0),
                      0.5 + 0.5 * cos(seconds + uv.y * 5.0),
                      0.5 + 0.5 * sin(pattern * 5.0 + seconds));

    // Output the fragment color
    fragColor = vec4(color, 1.0);
}
