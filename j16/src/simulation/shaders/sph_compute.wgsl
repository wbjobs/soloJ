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

struct SimParams {
  particleRadius: f32,
  padding0: f32,
  gravity: vec3<f32>,
  dt: f32,
  substeps: f32,
  smoothingRadius: f32,
  boundsMin: vec3<f32>,
  boundsMax: vec3<f32>,
  surfaceTension: f32,
  adhesionStrength: f32,
  repulsionStrength: f32,
  damping: f32,
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> cellStart: array<i32>;
@group(0) @binding(2) var<storage, read_write> cellCount: array<i32>;
@group(0) @binding(3) var<storage, read> sortedIndices: array<i32>;
@group(0) @binding(4) var<uniform> params: SimParams;
@group(0) @binding(5) var<storage, read> fluidProps: array<FluidProp>;

const POLY6: f32 = 315.0 / (64.0 * 3.141592653589793);
const SPIKY_GRAD: f32 = -45.0 / 3.141592653589793;
const VISC_LAP: f32 = 45.0 / 3.141592653589793;
const COHESION_COEFF: f32 = -32.0 / (3.141592653589793);
const TABLE_SIZE: i32 = 262144;

fn hashCell(cx: i32, cy: i32, cz: i32) -> i32 {
  var h: i32 = cx * 374761393 + cy * 668265263 + cz * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return abs(h % TABLE_SIZE);
}

fn cellCoord(pos: vec3<f32>, cellSize: f32) -> vec3<i32> {
  return vec3<i32>(
    i32(floor(pos.x / cellSize)),
    i32(floor(pos.y / cellSize)),
    i32(floor(pos.z / cellSize))
  );
}

@compute @workgroup_size(64)
fn computeDensityPressure(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i: u32 = gid.x;
  let count: u32 = arrayLength(&particles);
  if (i >= count) { return; }

  var pi = &particles[i];
  let myType = (*pi).type;
  let myProp = fluidProps[u32(myType)];

  let h = params.smoothingRadius;
  let h2 = h * h;
  let h9 = pow(h, 9.0);
  let poly6Coeff = POLY6 / h9;

  var density: f32 = 0.0;
  let pos = (*pi).position;

  let cellSize = h;
  let cc = cellCoord(pos, cellSize);

  for (var dz: i32 = -1; dz <= 1; dz++) {
    for (var dy: i32 = -1; dy <= 1; dy++) {
      for (var dx: i32 = -1; dx <= 1; dx++) {
        let cellHash = hashCell(cc.x + dx, cc.y + dy, cc.z + dz);
        let start = cellStart[cellHash];
        let cnt = cellCount[cellHash];
        for (var j: i32 = 0; j < cnt; j++) {
          let idx = u32(sortedIndices[u32(start + j)]);
          if (idx >= arrayLength(&particles)) { continue; }
          let pj = &particles[idx];
          let jType = (*pj).type;
          let jProp = fluidProps[u32(jType)];
          let diff = pos - (*pj).position;
          let r2 = dot(diff, diff);
          if (r2 < h2) {
            let diff2 = h2 - r2;
            let w = poly6Coeff * diff2 * diff2 * diff2;
            if (myType == jType) {
              density += myProp.mass * w;
            } else {
              let avgMass = (myProp.mass + jProp.mass) * 0.5;
              density += avgMass * w * 0.5;
            }
          }
        }
      }
    }
  }

  let minDensity = myProp.restDensity * 0.3;
  density = max(density, minDensity);
  (*pi).density = density;
  (*pi).pressure = myProp.pressureCoeff * (density - myProp.restDensity);
}

@compute @workgroup_size(64)
fn computeForces(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i: u32 = gid.x;
  let count: u32 = arrayLength(&particles);
  if (i >= count) { return; }

  var pi = &particles[i];
  let myType = (*pi).type;
  let myProp = fluidProps[u32(myType)];

  let h = params.smoothingRadius;
  let h6 = pow(h, 6.0);
  let h9 = pow(h, 9.0);
  let spikyCoeff = SPIKY_GRAD / h6;
  let viscCoeff = VISC_LAP / h6;
  let cohesionCoeff = COHESION_COEFF / h9;

  var fPressure = vec3<f32>(0.0);
  var fViscosity = vec3<f32>(0.0);
  var fSurfaceTension = vec3<f32>(0.0);
  var fRepulsion = vec3<f32>(0.0);

  let pos = (*pi).position;
  let dens = (*pi).density;
  let pres = (*pi).pressure;
  let vel = (*pi).velocity;

  let cellSize = h;
  let cc = cellCoord(pos, cellSize);

  for (var dz: i32 = -1; dz <= 1; dz++) {
    for (var dy: i32 = -1; dy <= 1; dy++) {
      for (var dx: i32 = -1; dx <= 1; dx++) {
        let cellHash = hashCell(cc.x + dx, cc.y + dy, cc.z + dz);
        let start = cellStart[cellHash];
        let cnt = cellCount[cellHash];
        for (var j: i32 = 0; j < cnt; j++) {
          let idx = u32(sortedIndices[u32(start + j)]);
          if (idx == i || idx >= arrayLength(&particles)) { continue; }
          let pj = &particles[idx];
          let jType = (*pj).type;
          let jProp = fluidProps[u32(jType)];

          let diff = pos - (*pj).position;
          let r = length(diff);
          if (r < h && r > 0.0001) {
            let rDiff = h - r;
            let dir = normalize(diff);

            let pjPres = (*pj).pressure;
            let pjDens = (*pj).density;
            let pjVel = (*pj).velocity;

            if (myType == jType) {
              let avgPres = (pres + pjPres) * 0.5;
              fPressure += dir * myProp.mass * avgPres / max(pjDens, 0.001) * spikyCoeff * rDiff * rDiff;

              let visc = myProp.viscosity;
              fViscosity += visc * myProp.mass * (pjVel - vel) / max(pjDens, 0.001) * viscCoeff * rDiff;
            } else {
              let avgPres = (pres + pjPres) * 0.5;
              let avgVisc = (myProp.viscosity + jProp.viscosity) * 0.5;
              let avgMass = (myProp.mass + jProp.mass) * 0.5;

              fPressure += dir * avgMass * avgPres / max(pjDens, 0.001) * spikyCoeff * rDiff * rDiff * 0.7;
              fViscosity += avgVisc * avgMass * (pjVel - vel) / max(pjDens, 0.001) * viscCoeff * rDiff * 0.5;

              let h2 = h * h;
              let r2 = r * r;
              let diff2 = h2 - r2;
              let cohesionW = cohesionCoeff * diff2 * diff2 * diff2;
              let tensionMag = params.surfaceTension * avgMass * cohesionW;
              fSurfaceTension += dir * tensionMag;

              if (r < h * 0.3) {
                let repulseW = (h * 0.3 - r) / (h * 0.3);
                let repulseMag = params.repulsionStrength * avgMass * repulseW * repulseW;
                fRepulsion += dir * repulseMag;
              }
            }
          }
        }
      }
    }
  }

  let fGravity = params.gravity * dens;
  (*pi).force = fPressure + fViscosity + fSurfaceTension + fRepulsion + fGravity;
}

@compute @workgroup_size(64)
fn integrate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i: u32 = gid.x;
  let count: u32 = arrayLength(&particles);
  if (i >= count) { return; }

  var pi = &particles[i];
  let myType = (*pi).type;
  let myProp = fluidProps[u32(myType)];

  let dt = params.dt / params.substeps;
  let damping = params.damping;

  var vel = (*pi).velocity + dt * (*pi).force / max((*pi).density, 0.001);
  vel *= damping;

  var pos = (*pi).position + dt * vel;

  let margin = params.particleRadius;
  let bMin = params.boundsMin;
  let bMax = params.boundsMax;

  if (pos.x < bMin.x + margin) {
    pos.x = bMin.x + margin;
    vel.x *= -0.5;
  }
  if (pos.x > bMax.x - margin) {
    pos.x = bMax.x - margin;
    vel.x *= -0.5;
  }
  if (pos.y < bMin.y + margin) {
    pos.y = bMin.y + margin;
    vel.y *= -0.5;
  }
  if (pos.y > bMax.y - margin) {
    pos.y = bMax.y - margin;
    vel.y *= -0.5;
  }
  if (pos.z < bMin.z + margin) {
    pos.z = bMin.z + margin;
    vel.z *= -0.5;
  }
  if (pos.z > bMax.z - margin) {
    pos.z = bMax.z - margin;
    vel.z *= -0.5;
  }

  (*pi).position = pos;
  (*pi).velocity = vel;

  let speed = length(vel);
  let t = clamp(speed / 3.0, 0.0, 1.0);
  let baseColor = myProp.color;
  let heatedColor = mix(baseColor, vec3<f32>(1.0, 0.8, 0.2), t * 0.4);
  (*pi).color = mix(baseColor, heatedColor, 0.0);
}