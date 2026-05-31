@group(0) @binding(0) var<uniform> params: vec4<f32>;
@group(0) @binding(1) var velocityField: texture_2d<f32>;
@group(0) @binding(2) var particleStartPositions: texture_2d<f32>;
@group(0) @binding(3) var particleEndPositions: texture_2d<f32>;
@group(0) @binding(4) var ftleField: texture_storage_2d<r32float, write>;
@group(0) @binding(5) var sampler: sampler;

const dx = 1.0;
const dy = 1.0;

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

fn sampleVelocity(uv: vec2<f32>) -> vec2<f32> {
  let resolution = vec2<f32>(params.xy);
  let clampedUV = clamp(uv, vec2<f32>(0.5 / resolution), vec2<f32>(1.0 - 0.5 / resolution));
  let v = textureSampleLevel(velocityField, sampler, clampedUV, 0.0).xy;
  return vec2<f32>(safeFloat(v.x), safeFloat(v.y));
}

fn advectParticle(pos: vec2<f32>, dt: f32) -> vec2<f32> {
  let resolution = vec2<f32>(params.xy);

  let k1 = sampleVelocity(pos) * dt * resolution;
  let k2 = sampleVelocity(pos + k1 * 0.5) * dt * resolution;
  let k3 = sampleVelocity(pos + k2 * 0.5) * dt * resolution;
  let k4 = sampleVelocity(pos + k3) * dt * resolution;

  var newPos = pos + (k1 + 2.0 * k2 + 2.0 * k3 + k4) / 6.0;
  newPos = clamp(newPos, vec2<f32>(0.001), vec2<f32>(0.999));
  return newPos;
}

@compute @workgroup_size(8, 8)
fn advectParticlesForward(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let resolution = vec2<u32>(params.xy);
  let pos = vec2<i32>(globalId.xy);

  if (pos.x >= i32(resolution.x) || pos.y >= i32(resolution.y)) {
    return;
  }

  let uv = (vec2<f32>(pos) + vec2<f32>(0.5)) / vec2<f32>(resolution);
  let dt = params.z;

  var particlePos = uv;
  let steps = u32(params.w);

  for (var i: u32 = 0; i < steps; i++) {
    particlePos = advectParticle(particlePos, dt);
  }

  textureStore(particleEndPositions, pos, vec4<f32>(particlePos, 0.0, 0.0));
}

@compute @workgroup_size(8, 8)
fn advectParticlesBackward(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let resolution = vec2<u32>(params.xy);
  let pos = vec2<i32>(globalId.xy);

  if (pos.x >= i32(resolution.x) || pos.y >= i32(resolution.y)) {
    return;
  }

  let uv = (vec2<f32>(pos) + vec2<f32>(0.5)) / vec2<f32>(resolution);
  let dt = -params.z;

  var particlePos = uv;
  let steps = u32(params.w);

  for (var i: u32 = 0; i < steps; i++) {
    particlePos = advectParticle(particlePos, dt);
  }

  textureStore(particleStartPositions, pos, vec4<f32>(particlePos, 0.0, 0.0));
}

@compute @workgroup_size(8, 8)
fn computeFTLE(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let resolution = vec2<u32>(params.xy);
  let pos = vec2<i32>(globalId.xy);

  if (pos.x < 1 || pos.x >= i32(resolution.x) - 1 || pos.y < 1 || pos.y >= i32(resolution.y) - 1) {
    textureStore(ftleField, pos, vec4<f32>(0.0, 0.0, 0.0, 0.0));
    return;
  }

  let invRes = 1.0 / vec2<f32>(resolution);
  let integrationTime = params.z;

  let posLeft = vec2<i32>(pos.x - 1, pos.y);
  let posRight = vec2<i32>(pos.x + 1, pos.y);
  let posDown = vec2<i32>(pos.x, pos.y - 1);
  let posUp = vec2<i32>(pos.x, pos.y + 1);

  let uvLeft = (vec2<f32>(posLeft) + 0.5) * invRes;
  let uvRight = (vec2<f32>(posRight) + 0.5) * invRes;
  let uvDown = (vec2<f32>(posDown) + 0.5) * invRes;
  let uvUp = (vec2<f32>(posUp) + 0.5) * invRes;

  let xLeft = textureSampleLevel(particleEndPositions, sampler, uvLeft, 0.0).xy;
  let xRight = textureSampleLevel(particleEndPositions, sampler, uvRight, 0.0).xy;
  let xDown = textureSampleLevel(particleEndPositions, sampler, uvDown, 0.0).xy;
  let xUp = textureSampleLevel(particleEndPositions, sampler, uvUp, 0.0).xy;

  var dxidx = (xRight - xLeft) * 0.5;
  var dxidy = (xUp - xDown) * 0.5;

  dxidx = vec2<f32>(safeFloat(dxidx.x), safeFloat(dxidx.y));
  dxidy = vec2<f32>(safeFloat(dxidy.x), safeFloat(dxidy.y));

  let h = f32(resolution.x);
  dxidx *= h;
  dxidy *= h;

  var C = mat2x2<f32>(0.0);
  C[0][0] = dxidx.x * dxidx.x + dxidx.y * dxidx.y;
  C[0][1] = dxidx.x * dxidy.x + dxidx.y * dxidy.y;
  C[1][0] = C[0][1];
  C[1][1] = dxidy.x * dxidy.x + dxidy.y * dxidy.y;

  let trace = C[0][0] + C[1][1];
  let det = C[0][0] * C[1][1] - C[0][1] * C[1][0];

  var lambdaMax = 0.0;
  if (trace >= 0.0) {
    lambdaMax = (trace + sqrt(max(trace * trace - 4.0 * det, 0.0))) * 0.5;
  }

  var ftle = 0.0;
  if (lambdaMax > 0.0 && integrationTime > 0.0) {
    ftle = 0.5 * log(max(lambdaMax, 1e-10)) / integrationTime;
  }

  ftle = safeFloat(ftle);
  ftle = clamp(ftle, 0.0, 100.0);

  textureStore(ftleField, pos, vec4<f32>(ftle, 0.0, 0.0, 0.0));
}

@compute @workgroup_size(8, 8)
fn computeLCS(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let resolution = vec2<u32>(params.xy);
  let pos = vec2<i32>(globalId.xy);

  if (pos.x < 2 || pos.x >= i32(resolution.x) - 2 || pos.y < 2 || pos.y >= i32(resolution.y) - 2) {
    textureStore(ftleField, pos, vec4<f32>(0.0, 0.0, 0.0, 0.0));
    return;
  }

  let invRes = 1.0 / vec2<f32>(resolution);
  let centerUV = (vec2<f32>(pos) + 0.5) * invRes;

  let centerVal = textureSampleLevel(ftleField, sampler, centerUV, 0.0).x;

  let offset = 1.5 * invRes;
  let uvX0 = centerUV - vec2<f32>(offset.x, 0.0);
  let uvX1 = centerUV + vec2<f32>(offset.x, 0.0);
  let uvY0 = centerUV - vec2<f32>(0.0, offset.y);
  let uvY1 = centerUV + vec2<f32>(0.0, offset.y);

  let vX0 = textureSampleLevel(ftleField, sampler, uvX0, 0.0).x;
  let vX1 = textureSampleLevel(ftleField, sampler, uvX1, 0.0).x;
  let vY0 = textureSampleLevel(ftleField, sampler, uvY0, 0.0).x;
  let vY1 = textureSampleLevel(ftleField, sampler, uvY1, 0.0).x;

  let gradX = (vX1 - vX0) / (2.0 * offset.x);
  let gradY = (vY1 - vY0) / (2.0 * offset.y);

  let gradMag = sqrt(gradX * gradX + gradY * gradY);

  var ridgeVal = 0.0;
  let threshold = params.z;
  if (gradMag > threshold && centerVal > 0.5) {
    let uvX00 = centerUV - vec2<f32>(2.0 * offset.x, 0.0);
    let uvX11 = centerUV + vec2<f32>(2.0 * offset.x, 0.0);
    let vX00 = textureSampleLevel(ftleField, sampler, uvX00, 0.0).x;
    let vX11 = textureSampleLevel(ftleField, sampler, uvX11, 0.0).x;

    let hessianXX = (vX11 - 2.0 * centerVal + vX00) / (offset.x * offset.x);
    if (hessianXX < 0.0) {
      ridgeVal = centerVal;
    }
  }

  ridgeVal = safeFloat(ridgeVal);
  textureStore(ftleField, pos, vec4<f32>(ridgeVal, 0.0, 0.0, 0.0));
}
