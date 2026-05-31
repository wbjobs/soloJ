import * as THREE from 'three'
import { extend } from '@react-three/fiber'

const vertexShader = `
attribute float size;
attribute float intensity;
attribute float classification;

varying vec3 vColor;
varying float vIntensity;
varying float vClassification;
varying vec3 vPosition;

uniform float pointSize;
uniform bool useIntensity;
uniform bool useClassification;
uniform float heightMin;
uniform float heightMax;

vec3 getHeightColor(float height) {
    float t = (height - heightMin) / (heightMax - heightMin);
    t = clamp(t, 0.0, 1.0);
    
    vec3 color0 = vec3(0.0, 0.0, 0.5);
    vec3 color1 = vec3(0.0, 0.5, 1.0);
    vec3 color2 = vec3(0.0, 1.0, 0.5);
    vec3 color3 = vec3(1.0, 1.0, 0.0);
    vec3 color4 = vec3(1.0, 0.5, 0.0);
    vec3 color5 = vec3(1.0, 0.0, 0.0);
    
    if (t < 0.2) return mix(color0, color1, t * 5.0);
    else if (t < 0.4) return mix(color1, color2, (t - 0.2) * 5.0);
    else if (t < 0.6) return mix(color2, color3, (t - 0.4) * 5.0);
    else if (t < 0.8) return mix(color3, color4, (t - 0.6) * 5.0);
    else return mix(color4, color5, (t - 0.8) * 5.0);
}

vec3 getClassificationColor(float cls) {
    if (cls == 2.0) return vec3(0.6, 0.4, 0.2);
    if (cls == 5.0) return vec3(0.0, 0.8, 0.2);
    if (cls == 6.0) return vec3(0.8, 0.2, 0.2);
    if (cls == 7.0) return vec3(0.5, 0.5, 0.5);
    if (cls == 9.0) return vec3(0.0, 0.4, 0.8);
    return vec3(0.7, 0.7, 0.7);
}

void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
    if (useIntensity) {
        float i = clamp(intensity / 65535.0, 0.0, 1.0);
        vColor = vec3(i);
    } else if (useClassification) {
        vColor = getClassificationColor(classification);
    } else if (color != vec3(0.0)) {
        vColor = color;
    } else {
        vColor = getHeightColor(position.z);
    }
    
    vIntensity = intensity;
    vClassification = classification;
    vPosition = position;
    
    gl_PointSize = pointSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}
`

const fragmentShader = `
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
`

class PointCloudMaterial extends THREE.ShaderMaterial {
  constructor(params = {}) {
    super({
      uniforms: {
        pointSize: { value: params.pointSize || 2.0 },
        useIntensity: { value: params.useIntensity || false },
        useClassification: { value: params.useClassification || false },
        heightMin: { value: params.heightMin || 0 },
        heightMax: { value: params.heightMax || 100 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }

  get pointSize() {
    return this.uniforms.pointSize.value
  }

  set pointSize(value) {
    this.uniforms.pointSize.value = value
  }

  get useIntensity() {
    return this.uniforms.useIntensity.value
  }

  set useIntensity(value) {
    this.uniforms.useIntensity.value = value
  }

  get useClassification() {
    return this.uniforms.useClassification.value
  }

  set useClassification(value) {
    this.uniforms.useClassification.value = value
  }

  get heightMin() {
    return this.uniforms.heightMin.value
  }

  set heightMin(value) {
    this.uniforms.heightMin.value = value
  }

  get heightMax() {
    return this.uniforms.heightMax.value
  }

  set heightMax(value) {
    this.uniforms.heightMax.value = value
  }
}

extend({ PointCloudMaterial })

export default PointCloudMaterial
