#version 300 es
// Vertex Shader runs on the GPU and is responsible for processing each vertex of the shape

// Defines the position of each vertex as an input to the vertex shader
layout(location=0) in vec4 position;
layout(location=1) in vec4 color;

// A uniform variable (constant across all vertices during one draw call) that holds the transformation matrix (rotation in this case). This matrix is multiplied by the vertex position to transform it (e.g., rotate it)
uniform mat4 uModelMatrix;

out vec4 vColor;

void main() {
    vColor = color;
    // This computes the final position of the vertex by multiplying the vertex's position by the transformation matrix (uModelMatrix), which rotates the shape
    gl_Position = uModelMatrix * position;
}

