struct Particle {
  position: vec3<f32>,
  padding0: f32,
  velocity: vec3<f32>,
  padding1: f32,
  density: f32,
  pressure: f32,
  type: i32,
  padding2: f32,
  force: vec3<f32>,
  padding3: f32,
  color: vec3<f32>,
  padding4: f32,
};

struct FluidProp {
  restDensity: f32,
  viscosity: f32,
  pressureCoeff: f32,
  mass: f32,
  color: vec3<f32>,
  padding: f32,
};

struct CameraUniforms {
  viewProj: mat4x4<f32>,
  view: mat4x4<f32>,
  proj: mat4x4<f32>,
  cameraPos: vec3<f32>,
  padding: f32,
};

struct SurfaceParams {
  particleRadius: f32,
  smoothingRadius: f32,
  isoValue: f32,
  maxParticles: i32,
  screenWidth: f32,
  screenHeight: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> camera: CameraUniforms;
@group(0) @binding(2) var<uniform> surfaceParams: SurfaceParams;
@group(0) @binding(3) var<storage, read> fluidProps: array<FluidProp>;

@group(1) @binding(0) var<storage, read> cellStart: array<i32>;
@group(1) @binding(1) var<storage, read> cellCount: array<i32>;
@group(1) @binding(2) var<storage, read> sortedIndices: array<i32>;

const POLY6: f32 = 315.0 / (64.0 * 3.141592653589793);
const SPIKY_GRAD: f32 = -45.0 / 3.141592653589793;
const TABLE_SIZE: i32 = 262144;

fn hashCell(cx: i32, cy: i32, cz: i32) -> i32 {
  var h: i32 = cx * 374761393 + cy * 668265263 + cz * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return abs(h % TABLE_SIZE);
}

fn computeFieldValue(pos: vec3<f32>) -> f32 {
  var value: f32 = 0.0;
  let h = surfaceParams.smoothingRadius;
  let h2 = h * h;
  let h9 = pow(h, 9.0);
  let poly6Coeff = POLY6 / h9;

  let cellSize = h;
  let cc = vec3<i32>(
    i32(floor(pos.x / cellSize)),
    i32(floor(pos.y / cellSize)),
    i32(floor(pos.z / cellSize))
  );

  for (var dz: i32 = -1; dz <= 1; dz++) {
    for (var dy: i32 = -1; dy <= 1; dy++) {
      for (var dx: i32 = -1; dx <= 1; dx++) {
        let cellHash = hashCell(cc.x + dx, cc.y + dy, cc.z + dz);
        let start = cellStart[cellHash];
        let cnt = cellCount[cellHash];
        for (var j: i32 = 0; j < cnt; j++) {
          let idx = u32(sortedIndices[u32(max(start, 0) + j)]);
          if (idx >= arrayLength(&particles)) { continue; }
          let p = particles[idx];
          let diff = pos - p.position;
          let r2 = dot(diff, diff);
          if (r2 < h2) {
            let diff2 = h2 - r2;
            let prop = fluidProps[u32(p.type)];
            value += prop.mass * poly6Coeff * diff2 * diff2 * diff2;
          }
        }
      }
    }
  }

  return value;
}

fn computeGradient(pos: vec3<f32>) -> vec3<f32> {
  var grad = vec3<f32>(0.0);
  let h = surfaceParams.smoothingRadius;
  let h6 = pow(h, 6.0);
  let coeff = SPIKY_GRAD / h6;

  let cellSize = h;
  let cc = vec3<i32>(
    i32(floor(pos.x / cellSize)),
    i32(floor(pos.y / cellSize)),
    i32(floor(pos.z / cellSize))
  );

  for (var dz: i32 = -1; dz <= 1; dz++) {
    for (var dy: i32 = -1; dy <= 1; dy++) {
      for (var dx: i32 = -1; dx <= 1; dx++) {
        let cellHash = hashCell(cc.x + dx, cc.y + dy, cc.z + dz);
        let start = cellStart[cellHash];
        let cnt = cellCount[cellHash];
        for (var j: i32 = 0; j < cnt; j++) {
          let idx = u32(sortedIndices[u32(max(start, 0) + j)]);
          if (idx >= arrayLength(&particles)) { continue; }
          let p = particles[idx];
          let diff = pos - p.position;
          let r = length(diff);
          if (r < h && r > 0.0001) {
            let rDiff = h - r;
            let dir = normalize(diff);
            let prop = fluidProps[u32(p.type)];
            grad += dir * prop.mass * coeff * rDiff * rDiff;
          }
        }
      }
    }
  }

  return grad;
}

fn getBlendedColor(pos: vec3<f32>) -> vec3<f32> {
  var totalWeight: f32 = 0.0;
  var blendedColor = vec3<f32>(0.0);
  let h = surfaceParams.smoothingRadius;
  let h2 = h * h;
  let h9 = pow(h, 9.0);
  let poly6Coeff = POLY6 / h9;

  let cellSize = h;
  let cc = vec3<i32>(
    i32(floor(pos.x / cellSize)),
    i32(floor(pos.y / cellSize)),
    i32(floor(pos.z / cellSize))
  );

  for (var dz: i32 = -1; dz <= 1; dz++) {
    for (var dy: i32 = -1; dy <= 1; dy++) {
      for (var dx: i32 = -1; dx <= 1; dx++) {
        let cellHash = hashCell(cc.x + dx, cc.y + dy, cc.z + dz);
        let start = cellStart[cellHash];
        let cnt = cellCount[cellHash];
        for (var j: i32 = 0; j < cnt; j++) {
          let idx = u32(sortedIndices[u32(max(start, 0) + j)]);
          if (idx >= arrayLength(&particles)) { continue; }
          let p = particles[idx];
          let diff = pos - p.position;
          let r2 = dot(diff, diff);
          if (r2 < h2) {
            let diff2 = h2 - r2;
            let w = poly6Coeff * diff2 * diff2 * diff2;
            let prop = fluidProps[u32(p.type)];
            blendedColor += prop.color * w;
            totalWeight += w;
          }
        }
      }
    }
  }

  if (totalWeight > 0.001) {
    return blendedColor / totalWeight;
  }
  return vec3<f32>(0.1, 0.4, 0.9);
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(-1.0, 1.0)
  );
  return vec4<f32>(pos[vi], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = vec2<f32>(fragCoord.x / surfaceParams.screenWidth, fragCoord.y / surfaceParams.screenHeight);

  let near = 0.1;
  let far = 100.0;
  let invProj = inverse(camera.proj);
  let invView = inverse(camera.view);

  let ndcPos = vec4<f32>(uv * 2.0 - 1.0, 0.0, 1.0);
  let viewPos = invProj * ndcPos;
  let worldDir = normalize((invView * vec4<f32>(viewPos.xyz, 0.0)).xyz);

  let rayOrigin = camera.cameraPos;

  var t: f32 = 0.0;
  var hitPos = vec3<f32>(0.0);
  var hitNormal = vec3<f32>(0.0);
  var found = false;

  let stepSize = surfaceParams.smoothingRadius * 0.5;
  let maxSteps: i32 = 512;

  for (var i: i32 = 0; i < maxSteps && t < far; i++) {
    let pos = rayOrigin + worldDir * t;
    let field = computeFieldValue(pos);

    if (field > surfaceParams.isoValue) {
      let tPrev = t - stepSize;
      let tNext = t;

      var lo = tPrev;
      var hi = tNext;
      for (var j: i32 = 0; j < 8; j++) {
        let mid = (lo + hi) * 0.5;
        let midPos = rayOrigin + worldDir * mid;
        let midField = computeFieldValue(midPos);
        if (midField > surfaceParams.isoValue) {
          hi = mid;
        } else {
          lo = mid;
        }
      }

      hitPos = rayOrigin + worldDir * hi;
      hitNormal = normalize(-computeGradient(hitPos));
      found = true;
      break;
    }

    t += stepSize;
  }

  if (!found) {
    let skyColor = mix(vec3<f32>(0.5, 0.7, 1.0), vec3<f32>(0.1, 0.1, 0.3), uv.y);
    return vec4<f32>(skyColor, 1.0);
  }

  let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.8));
  let viewDir = -worldDir;
  let halfDir = normalize(lightDir + viewDir);

  let diffuse = max(dot(hitNormal, lightDir), 0.0);
  let specular = pow(max(dot(hitNormal, halfDir), 0.0), 64.0);
  let ambient = 0.2;

  let baseColor = getBlendedColor(hitPos);
  let color = baseColor * (ambient + diffuse * 0.8) + vec3<f32>(1.0) * specular * 0.3;

  let fresnel = pow(1.0 - max(dot(hitNormal, viewDir), 0.0), 3.0);
  let finalColor = mix(color, vec3<f32>(0.6, 0.8, 1.0), fresnel * 0.4);

  return vec4<f32>(finalColor, 1.0);
}