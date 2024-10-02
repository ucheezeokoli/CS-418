#version 300 es
precision highp float;

in vec4 vColor;

uniform float seconds;

out vec4 fragColor;

void main() {
    float c = cos(seconds)*0.5+0.5, s = sin(seconds)*0.5+0.5;
    fragColor = vec4(
        vColor.r*c + vColor.g*s,
        vColor.g*c - vColor.r*s,
        cos(vColor.b*20.-vColor.a*10.)*0.5+0.5,
        vColor.a
    );
}

