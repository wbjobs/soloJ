@group(0) @binding(0) var<uniform> params: vec4<f32>;
@group(0) @binding(1) var output: texture_storage_2d<rg32float, write>;

fn vortexVelocity(center: vec2<f32>, pos: vec2<f32>, strength: f32, radius: f32) -> vec2<f32> {
  let r = pos - center;
  let dist = length(r);
  if (dist < 1e-4 || dist > radius) {
    return vec2<f32>(0.0);
  }
  let tangent = vec2<f32>(-r.y, r.x) / dist;
  let decay = 1.0 - (dist / radius);
  return tangent * strength * decay * decay;
}

fn jetVelocity(center: vec2<f32>, pos: vec2<f32>, direction: vec2<f32>, strength: f32, width: f32) -> vec2<f32> {
  let r = pos - center;
  let perp = dot(r, vec2<f32>(-direction.y, direction.x));
  let profile = exp(-(perp * perp) / (width * width));
  return direction * strength * profile;
}

fn gaussian(center: vec2<f32>, pos: vec2<f32>, sigma: f32) -> f32 {
  let r = pos - center;
  let distSq = dot(r, r);
  return exp(-distSq / (2.0 * sigma * sigma));
}

@compute @workgroup_size(8, 8)
fn generateVortexPair(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let resolution = vec2<f32>(params.xy);
  let pos = vec2<i32>(globalId.xy);

  if (pos.x >= i32(resolution.x) || pos.y >= i32(resolution.y)) {
    return;
  }

  let uv = (vec2<f32>(pos) + vec2<f32>(0.5)) / resolution;
  let posF = uv * 2.0 - vec2<f32>(1.0);

  var v = vec2<f32>(0.0);

  let center1 = vec2<f32>(-0.3, 0.0);
  let center2 = vec2<f32>(0.3, 0.0);

  v += vortexVelocity(center1, posF, 1.0, 0.6);
  v -= vortexVelocity(center2, posF, 1.0, 0.6);

  v *= 50.0;

  textureStore(output, pos, vec4<f32>(v, 0.0, 0.0));
}

@compute @workgroup_size(8, 8)
fn generateShearLayer(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let resolution = vec2<f32>(params.xy);
  let pos = vec2<i32>(globalId.xy);

  if (pos.x >= i32(resolution.x) || pos.y >= i32(resolution.y)) {
    return;
  }

  let uv = (vec2<f32>(pos) + vec2<f32>(0.5)) / resolution;
  let posF = uv * 2.0 - vec2<f32>(1.0);

  var v = vec2<f32>(0.0);

  let shearStrength = 1.0;
  let layerThickness = 0.2;

  if (posF.y > layerThickness) {
    v.x = shearStrength;
  } else if (posF.y < -layerThickness) {
    v.x = -shearStrength;
  } else {
    let t = posF.y / layerThickness;
    v.x = shearStrength * smoothStep(-1.0, 1.0, t);
  }

  let perturbation = sin(posF.x * 10.0) * 0.05 * exp(-(posF.y * posF.y) / 0.01);
  v.y = perturbation;

  v *= 30.0;

  textureStore(output, pos, vec4<f32>(v, 0.0, 0.0));
}

@compute @workgroup_size(8, 8)
fn generateJet(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let resolution = vec2<f32>(params.xy);
  let pos = vec2<i32>(globalId.xy);

  if (pos.x >= i32(resolution.x) || pos.y >= i32(resolution.y)) {
    return;
  }

  let uv = (vec2<f32>(pos) + vec2<f32>(0.5)) / resolution;
  let posF = uv * 2.0 - vec2<f32>(1.0);

  var v = vec2<f32>(0.0);

  let center = vec2<f32>(-0.8, 0.0);
  let direction = vec2<f32>(1.0, 0.0);

  v = jetVelocity(center, posF, direction, 2.0, 0.2);

  v *= 50.0;

  textureStore(output, pos, vec4<f32>(v, 0.0, 0.0));
}

@compute @workgroup_size(8, 8)
fn generateDoubleVortex(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let resolution = vec2<f32>(params.xy);
  let pos = vec2<i32>(globalId.xy);

  if (pos.x >= i32(resolution.x) || pos.y >= i32(resolution.y)) {
    return;
  }

  let uv = (vec2<f32>(pos) + vec2<f32>(0.5)) / resolution;
  let posF = uv * 2.0 - vec2<f32>(1.0);

  var v = vec2<f32>(0.0);

  let centers = array<vec2<f32>, 4>(
    vec2<f32>(-0.4, 0.4),
    vec2<f32>(0.4, 0.4),
    vec2<f32>(-0.4, -0.4),
    vec2<f32>(0.4, -0.4)
  );

  let strengths = array<f32, 4>(1.0, -1.0, -1.0, 1.0);

  for (var i: i32 = 0; i < 4; i++) {
    v += vortexVelocity(centers[i], posF, strengths[i], 0.5);
  }

  v *= 40.0;

  textureStore(output, pos, vec4<f32>(v, 0.0, 0.0));
}

@compute @workgroup_size(8, 8)
fn generateTurbulent(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let resolution = vec2<f32>(params.xy);
  let pos = vec2<i32>(globalId.xy);

  if (pos.x >= i32(resolution.x) || pos.y >= i32(resolution.y)) {
    return;
  }

  let uv = (vec2<f32>(pos) + vec2<f32>(0.5)) / resolution;
  let posF = uv * 2.0 - vec2<f32>(1.0);

  var v = vec2<f32>(0.0);

  let scales = array<f32, 5>(1.0, 0.5, 0.25, 0.125, 0.0625);
  let amplitudes = array<f32, 5>(1.0, 0.7, 0.5, 0.3, 0.2);

  for (var i: i32 = 0; i < 5; i++) {
    let scale = scales[i];
    let amp = amplitudes[i];

    let xNoise = sin(posF.x / scale * 10.0) * cos(posF.y / scale * 7.0);
    let yNoise = cos(posF.x / scale * 7.0) * sin(posF.y / scale * 10.0);

    v.x += yNoise * amp * 20.0;
    v.y += -xNoise * amp * 20.0;
  }

  textureStore(output, pos, vec4<f32>(v, 0.0, 0.0));
}
