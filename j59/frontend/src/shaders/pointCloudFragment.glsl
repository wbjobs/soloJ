varying vec3 vColor;
varying float vIntensity;
varying float vClassification;
varying vec3 vPosition;

uniform float pointSize;
uniform bool useIntensity;
uniform bool useClassification;

void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    if (dist > 0.5) {
        discard;
    }
    
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    alpha = clamp(alpha, 0.3, 1.0);
    
    gl_FragColor = vec4(vColor, alpha);
}
