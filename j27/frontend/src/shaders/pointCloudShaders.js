export const pointCloudVertexShader = `
  uniform float uPointSize;
  uniform int uColoringMode;
  uniform float uMinHeight;
  uniform float uMaxHeight;
  uniform float uMinIntensity;
  uniform float uMaxIntensity;
  uniform int uCategoryFilter[7];
  uniform int uHasCategoryFilter;

  attribute float aIntensity;
  attribute float aCategory;

  varying vec3 vColor;
  varying float vHeight;
  varying float vIntensity;
  varying float vCategory;

  vec3 getCategoryColor(float category) {
    int cat = int(category);
    if (cat == 0) return vec3(0.549, 0.549, 0.549);
    if (cat == 1) return vec3(0.0, 0.706, 0.0);
    if (cat == 2) return vec3(0.784, 0.392, 0.196);
    if (cat == 3) return vec3(1.0, 0.0, 0.0);
    if (cat == 4) return vec3(1.0, 1.0, 0.0);
    if (cat == 5) return vec3(0.588, 0.294, 0.0);
    return vec3(1.0, 0.0, 1.0);
  }

  vec3 heightToColor(float height, float minH, float maxH) {
    float t = clamp((height - minH) / (maxH - minH), 0.0, 1.0);
    
    vec3 blue = vec3(0.0, 0.0, 1.0);
    vec3 cyan = vec3(0.0, 1.0, 1.0);
    vec3 green = vec3(0.0, 1.0, 0.0);
    vec3 yellow = vec3(1.0, 1.0, 0.0);
    vec3 red = vec3(1.0, 0.0, 0.0);
    
    if (t < 0.25) {
      return mix(blue, cyan, t * 4.0);
    } else if (t < 0.5) {
      return mix(cyan, green, (t - 0.25) * 4.0);
    } else if (t < 0.75) {
      return mix(green, yellow, (t - 0.5) * 4.0);
    } else {
      return mix(yellow, red, (t - 0.75) * 4.0);
    }
  }

  vec3 intensityToColor(float intensity, float minI, float maxI) {
    float t = clamp((intensity - minI) / (maxI - minI), 0.0, 1.0);
    return vec3(t, t, t);
  }

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    float distance = length(mvPosition.xyz);
    gl_PointSize = uPointSize * (300.0 / distance);
    
    vHeight = position.z;
    vIntensity = aIntensity;
    vCategory = aCategory;

    if (uHasCategoryFilter == 1) {
      int cat = int(aCategory);
      bool visible = false;
      for (int i = 0; i < 7; i++) {
        if (uCategoryFilter[i] == cat) {
          visible = true;
          break;
        }
      }
      if (!visible) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        gl_PointSize = 0.0;
        vColor = vec3(0.0);
        return;
      }
    }
    
    if (uColoringMode == 0) {
      vColor = heightToColor(position.z, uMinHeight, uMaxHeight);
    } else if (uColoringMode == 1) {
      vColor = intensityToColor(aIntensity, uMinIntensity, uMaxIntensity);
    } else if (uColoringMode == 2) {
      vColor = getCategoryColor(aCategory);
    } else {
      vColor = color;
    }
  }
`;

export const pointCloudFragmentShader = `
  varying vec3 vColor;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    if (dist > 0.5) {
      discard;
    }
    
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    
    gl_FragColor = vec4(vColor, alpha);
  }
`;

export const measurementVertexShader = `
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = 8.0 * (300.0 / length(mvPosition.xyz));
  }
`;

export const measurementFragmentShader = `
  uniform vec3 uColor;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    if (dist > 0.5) {
      discard;
    }
    
    gl_FragColor = vec4(uColor, 1.0);
  }
`;
