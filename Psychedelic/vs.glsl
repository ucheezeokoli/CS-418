#version 300 es
precision highp float;

out vec2 v_Position;  // Output variable to pass to the fragment shader

void main() {
    // Map the gl_VertexID (0 to 5) to corresponding positions on the screen
    vec2 positions[6] = vec2[6](
        vec2(-1.0, -1.0),  // Vertex 0
        vec2( 1.0, -1.0),  // Vertex 1
        vec2(-1.0,  1.0),  // Vertex 2
        vec2(-1.0,  1.0),  // Vertex 3
        vec2( 1.0, -1.0),  // Vertex 4
        vec2( 1.0,  1.0)   // Vertex 5
    );
    
    // Assign position based on gl_VertexID
    gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);

    // Pass the position to the fragment shader
    v_Position = positions[gl_VertexID];
}
