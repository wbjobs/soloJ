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

struct LightParams {
  direction: vec3<f32>,
  padding1: f32,
  color: vec3<f32>,
  padding2: f32,
  ambient: f32,
  maxBounces: i32,
  sampleCount: i32,
  padding3: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> camera: CameraUniforms;
@group(0) @binding(2) var<uniform> lightParams: LightParams;
@group(0) @binding(3) var<storage, read> fluidProps: array<FluidProp>;

@group(1) @binding(0) var<storage, read> cellStart: array<i32>;
@group(1) @binding(1) var<storage, read> cellCount: array<i32>;
@group(1) @binding(2) var<storage, read> sortedIndices: array<i32>;

const PARTICLE_RADIUS: f32 = 0.3;
const SMALL_OFFSET: f32 = 0.001;
const TABLE_SIZE: i32 = 262144;
const CELL_SIZE: f32 = 2.0;

fn hashCell(cx: i32, cy: i32, cz: i32) -> i32 {
  var h: i32 = cx * 374761393 + cy * 668265263 + cz * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return abs(h % TABLE_SIZE);
}

struct Ray {
  origin: vec3<f32>,
  direction: vec3<f32>,
  invDir: vec3<f32>,
};

struct Intersection {
  t: f32,
  normal: vec3<f32>,
  color: vec3<f32>,
  density: f32,
  hit: bool,
};

fn intersectSphere(ray: Ray, center: vec3<f32>, radius: f32, tMax: f32) -> f32 {
  let oc = ray.origin - center;
  let a = dot(ray.direction, ray.direction);
  let b = 2.0 * dot(oc, ray.direction);
  let c = dot(oc, oc) - radius * radius;
  let discriminant = b * b - 4.0 * a * c;
  
  if (discriminant < 0.0) {
    return -1.0;
  }
  
  let sq = sqrt(discriminant);
  let t1 = (-b - sq) / (2.0 * a);
  let t2 = (-b + sq) / (2.0 * a);
  
  if (t1 > SMALL_OFFSET && t1 < tMax) {
    return t1;
  }
  if (t2 > SMALL_OFFSET && t2 < tMax) {
    return t2;
  }
  
  return -1.0;
}

fn collectCandidates(ray: Ray, maxDist: f32) -> Intersection {
  var result: Intersection;
  result.t = maxDist;
  result.hit = false;

  let minPoint = ray.origin + vec3<f32>(
    min(0.0, ray.direction.x * maxDist),
    min(0.0, ray.direction.y * maxDist),
    min(0.0, ray.direction.z * maxDist)
  );
  let maxPoint = ray.origin + vec3<f32>(
    max(0.0, ray.direction.x * maxDist),
    max(0.0, ray.direction.y * maxDist),
    max(0.0, ray.direction.z * maxDist)
  );

  let minCell = vec3<i32>(
    i32(floor(minPoint.x / CELL_SIZE)),
    i32(floor(minPoint.y / CELL_SIZE)),
    i32(floor(minPoint.z / CELL_SIZE))
  );
  let maxCell = vec3<i32>(
    i32(floor(maxPoint.x / CELL_SIZE)),
    i32(floor(maxPoint.y / CELL_SIZE)),
    i32(floor(maxPoint.z / CELL_SIZE))
  );

  for (var cz: i32 = minCell.z; cz <= maxCell.z; cz++) {
    for (var cy: i32 = minCell.y; cy <= maxCell.y; cy++) {
      for (var cx: i32 = minCell.x; cx <= maxCell.x; cx++) {
        let cellHash = hashCell(cx, cy, cz);
        let start = cellStart[cellHash];
        let cnt = cellCount[cellHash];
        if (cnt <= 0) { continue; }
        for (var j: i32 = 0; j < cnt; j++) {
          let idx = u32(sortedIndices[u32(max(start, 0) + j)]);
          if (idx >= arrayLength(&particles)) { continue; }
          let p = particles[idx];
          let t = intersectSphere(ray, p.position, PARTICLE_RADIUS, result.t);
          if (t > 0.0 && t < result.t) {
            result.t = t;
            result.normal = normalize((ray.origin + ray.direction * t) - p.position);
            result.color = p.color;
            result.density = p.density;
            result.hit = true;
          }
        }
      }
    }
  }

  return result;
}

fn computeBlendedColor(hitPos: vec3<f32>, hitNormal: vec3<f32>, hitType: i32) -> vec3<f32> {
  var totalWeight: f32 = 0.0;
  var blendedColor = vec3<f32>(0.0);
  let h = PARTICLE_RADIUS * 2.0;
  let h2 = h * h;
  let h9 = pow(h, 9.0);
  let poly6Coeff = 315.0 / (64.0 * 3.141592653589793) / h9;

  let cc = vec3<i32>(
    i32(floor(hitPos.x / CELL_SIZE)),
    i32(floor(hitPos.y / CELL_SIZE)),
    i32(floor(hitPos.z / CELL_SIZE))
  );

  for (var dz: i32 = -1; dz <= 1; dz++) {
    for (var dy: i32 = -1; dy <= 1; dy++) {
      for (var dx: i32 = -1; dx <= 1; dx++) {
        let cellHash = hashCell(cc.x + dx, cc.y + dy, cc.z + dz);
        let start = cellStart[cellHash];
        let cnt = cellCount[cellHash];
        if (cnt <= 0) { continue; }
        for (var j: i32 = 0; j < cnt; j++) {
          let idx = u32(sortedIndices[u32(max(start, 0) + j)]);
          if (idx >= arrayLength(&particles)) { continue; }
          let p = particles[idx];
          let diff = hitPos - p.position;
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
  return fluidProps[u32(hitType)].color;
}

fn traceRay(ray: Ray) -> vec3<f32> {
  var color = vec3<f32>(0.0);
  var currentRay = ray;
  var throughput = vec3<f32>(1.0);
  
  let numBounces = lightParams.maxBounces;
  
  for (var bounce: i32 = 0; bounce < numBounces; bounce++) {
    let hit = collectCandidates(currentRay, 50.0);
    
    if (!hit.hit) {
      let skyColor = mix(vec3<f32>(0.1, 0.15, 0.25), vec3<f32>(0.4, 0.6, 0.9), 0.5 + 0.5 * currentRay.direction.y);
      color += throughput * skyColor;
      break;
    }
    
    let hitPos = currentRay.origin + currentRay.direction * hit.t;
    let viewDir = -currentRay.direction;
    
    let hitType = 0;
    let surfaceColor = computeBlendedColor(hitPos, hit.normal, hitType);
    
    let diffuse = surfaceColor * lightParams.ambient;
    
    let ndl = max(dot(hit.normal, lightParams.direction), 0.0);
    let direct = surfaceColor * ndl * lightParams.color * (1.0 - lightParams.ambient);
    
    var specular = vec3<f32>(0.0);
    if (ndl > 0.0) {
      let halfDir = normalize(lightParams.direction + viewDir);
      let spec = pow(max(dot(hit.normal, halfDir), 0.0), 32.0);
      specular = vec3<f32>(1.0) * spec * 0.3;
    }
    
    let totalColor = diffuse + direct + specular;
    color += throughput * totalColor;
    
    let cosTheta = dot(hit.normal, viewDir);
    let F0 = 0.02;
    let fresnel = F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
    
    let reflectDir = reflect(-viewDir, hit.normal);
    let reflectRay = Ray(
      hitPos + hit.normal * SMALL_OFFSET,
      reflectDir,
      1.0 / max(vec3<f32>(0.0001), reflectDir)
    );
    
    let nextHit = collectCandidates(reflectRay, 20.0);
    if (nextHit.hit) {
      let reflectColor = nextHit.color * ndl * lightParams.color * 0.3;
      color += throughput * fresnel * reflectColor;
    }
    
    throughput *= (1.0 - fresnel) * 0.1;
    
    if (all(throughput < vec3<f32>(0.01))) { break; }
    
    currentRay = reflectRay;
  }
  
  return color;
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
  let fragX = f32(u32(fragCoord.x));
  let fragY = f32(u32(fragCoord.y));
  let width: f32 = 1280.0;
  let height: f32 = 720.0;

  let uv = vec2<f32>(
    (fragX / width) * 2.0 - 1.0,
    (fragY / height) * 2.0 - 1.0
  );

  let invProj = inverse(camera.proj);
  let invView = inverse(camera.view);
  
  let rayDirView = normalize((invProj * vec4<f32>(uv, -1.0, 0.0)).xyz);
  let rayDirWorld = normalize((invView * vec4<f32>(rayDirView, 0.0)).xyz);
  
  var ray = Ray(
    camera.cameraPos,
    rayDirWorld,
    1.0 / max(vec3<f32>(0.0001), rayDirWorld)
  );
  
  let color = traceRay(ray);
  
  let tonemapped = color / (color + vec3<f32>(1.0));
  let gammaCorrected = pow(tonemapped, vec3<f32>(1.0 / 2.2));
  
  return vec4<f32>(gammaCorrected, 1.0);
}