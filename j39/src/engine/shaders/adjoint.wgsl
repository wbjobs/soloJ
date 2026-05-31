@group(0) @binding(0) var<uniform> params: vec4<f32>;
@group(0) @binding(1) var velocityIn: texture_2d<f32>;
@group(0) @binding(2) var targetVelocity: texture_2d<f32>;
@group(0) @binding(3) var adjointIn: texture_2d<f32>;
@group(0) @binding(4) var adjointOut: texture_storage_2d<rg32float, write>;
@group(0) @binding(5) var gradientOut: texture_storage_2d<rg32float, write>;
@group(0) @binding(6) var sampler: sampler;

const dx = 1.0;
const dy = 1.0;
const invDx = 1.0 / dx;
const invDy = 1.0 / dy;

fn isNan(val: f32) -> bool {
  return !(val == val);
}

fn isInf(val: f32) -> bool {
  return abs(val) > 1e6;
}

fn safeFloat(val: f32) -> f32 {
  if (isNan(val) || isInf(val)) {
    return 0.0;
  }
  return val;
}

fn safeVec2(v: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(safeFloat(v.x), safeFloat(v.y));
}

fn sampleVelocity(uv: vec2<f32>) -> vec2<f32> {
  let resolution = vec2<f32>(params.xy);
  let clampedUV = clamp(uv, vec2<f32>(0.5 / resolution), vec2<f32>(1.0 - 0.5 / resolution));
  let v = textureSampleLevel(velocityIn, sampler, clampedUV, 0.0).xy;
  return safeVec2(v);
}

fn sampleAdjoint(uv: vec2<f32>) -> vec2<f32> {
  let resolution = vec2<f32>(params.xy);
  let clampedUV = clamp(uv, vec2<f32>(0.5 / resolution), vec2<f32>(1.0 - 0.5 / resolution));
  let v = textureSampleLevel(adjointIn, sampler, clampedUV, 0.0).xy;
  return safeVec2(v);
}

@compute @workgroup_size(8, 8)
fn computeAdjointStep(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let resolution = vec2<u32>(params.xy);
  let pos = vec2<i32>(globalId.xy);

  if (pos.x >= i32(resolution.x) || pos.y >= i32(resolution.y)) {
    return;
  }

  let uv = (vec2<f32>(pos) + vec2<f32>(0.5)) / vec2<f32>(resolution);
  let dt = params.z;
  let viscosity = params.w;

  let isBoundaryX = pos.x == 0 || pos.x == i32(resolution.x) - 1;
  let isBoundaryY = pos.y == 0 || pos.y == i32(resolution.y) - 1;

  if (isBoundaryX || isBoundaryY) {
    textureStore(adjointOut, pos, vec4<f32>(0.0, 0.0, 0.0, 0.0));
    return;
  }

  let posF = vec2<f32>(pos);
  let invRes = 1.0 / vec2<f32>(resolution);

  let uvLeft = (vec2<f32>(pos.x - 1, pos.y) + 0.5) * invRes;
  let uvRight = (vec2<f32>(pos.x + 1, pos.y) + 0.5) * invRes;
  let uvDown = (vec2<f32>(pos.x, pos.y - 1) + 0.5) * invRes;
  let uvUp = (vec2<f32>(pos.x, pos.y + 1) + 0.5) * invRes;

  let v = sampleVelocity(uv);
  let vLeft = sampleVelocity(uvLeft);
  let vRight = sampleVelocity(uvRight);
  let vDown = sampleVelocity(uvDown);
  let vUp = sampleVelocity(uvUp);

  let adj = sampleAdjoint(uv);
  let adjLeft = sampleAdjoint(uvLeft);
  let adjRight = sampleAdjoint(uvRight);
  let adjDown = sampleAdjoint(uvDown);
  let adjUp = sampleAdjoint(uvUp);

  var adjTime = vec2<f32>(0.0);

  let dudx = (vRight.x - vLeft.x) * invDx * 0.5;
  let dudy = (vUp.x - vDown.x) * invDy * 0.5;
  let dvdx = (vRight.y - vLeft.y) * invDx * 0.5;
  let dvdy = (vUp.y - vDown.y) * invDy * 0.5;

  adjTime.x = -v.x * ((adjRight.x - adjLeft.x) * invDx * 0.5)
            - v.y * ((adjUp.x - adjDown.x) * invDy * 0.5)
            - adj.x * dudx
            - adj.y * dvdx;

  adjTime.y = -v.x * ((adjRight.y - adjLeft.y) * invDx * 0.5)
            - v.y * ((adjUp.y - adjDown.y) * invDy * 0.5)
            - adj.x * dudy
            - adj.y * dvdy;

  if (viscosity > 0.0) {
    let laplacianX = (adjLeft.x + adjRight.x + adjDown.x + adjUp.x - 4.0 * adj.x) * invDx * invDx;
    let laplacianY = (adjLeft.y + adjRight.y + adjDown.y + adjUp.y - 4.0 * adj.y) * invDy * invDy;
    adjTime.x += viscosity * laplacianX;
    adjTime.y += viscosity * laplacianY;
  }

  adjTime = safeVec2(adjTime);
  adjTime = clamp(adjTime, vec2<f32>(-1e3), vec2<f32>(1e3));

  let targetV = textureSampleLevel(targetVelocity, sampler, uv, 0.0).xy;
  let costGradient = v - targetV;
  textureStore(gradientOut, pos, vec4<f32>(costGradient, 0.0, 0.0));

  textureStore(adjointOut, pos, vec4<f32>(adj - adjTime * dt, 0.0, 0.0));
}

@compute @workgroup_size(8, 8)
fn applyGradient(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let resolution = vec2<u32>(params.xy);
  let pos = vec2<i32>(globalId.xy);

  if (pos.x >= i32(resolution.x) || pos.y >= i32(resolution.y)) {
    return;
  }

  let uv = (vec2<f32>(pos) + vec2<f32>(0.5)) / vec2<f32>(resolution);
  let learningRate = params.z;

  let currentVel = textureSampleLevel(velocityIn, sampler, uv, 0.0).xy;
  let gradient = textureSampleLevel(gradientOut, sampler, uv, 0.0).xy;

  var updatedVel = currentVel - learningRate * gradient;
  updatedVel = safeVec2(updatedVel);
  updatedVel = clamp(updatedVel, vec2<f32>(-1e3), vec2<f32>(1e3));

  textureStore(velocityIn, pos, vec4<f32>(updatedVel, 0.0, 0.0));
}
