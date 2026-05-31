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

struct CameraUniforms {
  viewProj: mat4x4<f32>,
  view: mat4x4<f32>,
  proj: mat4x4<f32>,
  cameraPos: vec3<f32>,
  padding: f32,
};

struct RenderParams {
  particleRadius: f32,
  maxParticles: i32,
  screenWidth: f32,
  screenHeight: f32,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
@group(0) @binding(1) var<uniform> camera: CameraUniforms;
@group(0) @binding(2) var<uniform> renderParams: RenderParams;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) localPos: vec2<f32>,
  @location(1) color: vec3<f32>,
  @location(2) worldPos: vec3<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VSOutput {
  var out: VSOutput;
  let particleIdx = vi / 6u;
  let vertIdx = vi % 6u;

  if (particleIdx >= u32(renderParams.maxParticles)) {
    out.position = vec4<f32>(-100.0, -100.0, 0.0, 1.0);
    return out;
  }

  var quadPos: vec2<f32>;
  switch (vertIdx) {
    case 0u { quadPos = vec2<f32>(-1.0, -1.0); }
    case 1u { quadPos = vec2<f32>(1.0, -1.0); }
    case 2u { quadPos = vec2<f32>(1.0, 1.0); }
    case 3u { quadPos = vec2<f32>(-1.0, -1.0); }
    case 4u { quadPos = vec2<f32>(1.0, 1.0); }
    default { quadPos = vec2<f32>(-1.0, 1.0); }
  }

  let p = particles[particleIdx];
  let worldPos = p.position;

  let clipPos = camera.proj * camera.view * vec4<f32>(worldPos, 1.0);
  let clipPos2 = camera.proj * camera.view * vec4<f32>(
    worldPos + vec3<f32>(quadPos.x * renderParams.particleRadius, quadPos.y * renderParams.particleRadius, 0.0),
    1.0
  );

  out.position = vec4<f32>(
    clipPos2.xy,
    clipPos.z / clipPos.w,
    1.0
  );
  out.localPos = quadPos;
  out.color = p.color;
  out.worldPos = worldPos;

  return out;
}

@fragment
fn fs_main(input: VSOutput) -> @location(0) vec4<f32> {
  let dist = length(input.localPos);
  if (dist > 1.0) { discard; }

  let alpha = 1.0 - smoothstep(0.7, 1.0, dist);
  let normal = normalize(vec3<f32>(input.localPos, sqrt(1.0 - dist * dist)));

  let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.8));
  let viewDir = normalize(camera.cameraPos - input.worldPos);
  let halfDir = normalize(lightDir + viewDir);

  let diffuse = max(dot(normal, lightDir), 0.0);
  let specular = pow(max(dot(normal, halfDir), 0.0), 32.0);

  let ambient = 0.3;
  let color = input.color * (ambient + diffuse * 0.7) + vec3<f32>(1.0) * specular * 0.5;

  return vec4<f32>(color, alpha);
}