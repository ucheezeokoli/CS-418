#version 300 es
// Fragment Shader determines the color of each pixel in the shape after the vertex positions are transformed by the vertex shader

// Sets the precision for floating-point operations (high precision in this case)
precision highp float;

in vec4 vColor;
out vec4 fragColor;

void main() {
    // Outputs the color for the shape
    fragColor = vColor;
}
