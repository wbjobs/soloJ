@group(0) @binding(0) var<storage, read_write> params: vec4<f32>;
@group(0) @binding(1) var<storage, read_write> forceData: array<vec4<f32>, 64>;
@group(0) @binding(2) var velocityIn: texture_2d<f32>;
@group(0) @binding(3) var velocityOut: texture_storage_2d<rg32float, write>;
@group(0) @binding(4) var densityIn: texture_2d<f32>;
@group(0) @binding(5) var densityOut: texture_storage_2d<rgba32float, write>;

var<private> invResolution: f32;
var<private> halfInvRes: f32;
var<private> dt: f32;
var<private> numForces: u32;

var<sample_type> sampler: sampler;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let resolution = params.x;
    invResolution = 1.0 / resolution;
    halfInvRes = 0.5 * invResolution;
    dt = params.y;
    numForces = u32(params.z);

    let texel = vec2<f32>(f32(id.x), f32(id.y));
    let uv = texel * invResolution + halfInvRes;

    var vel = textureSampleLevel(velocityIn, sampler, uv, 0.0).xy;
    var dens = textureSampleLevel(densityIn, sampler, uv, 0.0);

    for (var i = 0u; i < numForces; i = i + 1u) {
        let forcePos = forceData[i * 3u].xy;
        let forceParams = forceData[i * 3u + 1u];
        let forceColor = forceData[i * 3u + 2u];

        let strength = forceParams.x;
        let radius = forceParams.y;
        let forceType = forceParams.z;

        let diff = uv - forcePos;
        let dist = length(diff);
        let normalizedDist = dist / radius;

        if (normalizedDist < 1.0) {
            let falloff = 1.0 - normalizedDist;
            let falloffSq = falloff * falloff;

            var forceDir = vec2<f32>(0.0, 0.0);

            if (forceType == 0.0) {
                forceDir = -normalize(diff + vec2<f32>(0.0001));
            } else if (forceType == 1.0) {
                forceDir = normalize(diff + vec2<f32>(0.0001));
            } else if (forceType == 2.0) {
                let tangent = vec2<f32>(-diff.y, diff.x);
                forceDir = normalize(tangent + vec2<f32>(0.0001));
            }

            let force = forceDir * strength * falloffSq;
            vel = vel + force * dt;

            if (forceColor.w > 0.0) {
                dens = mix(dens, forceColor, falloffSq * forceColor.w * dt * 10.0);
            }
        }
    }

    let writePos = vec2<i32>(i32(id.x), i32(id.y));
    textureStore(velocityOut, writePos, vec4<f32>(vel, 0.0, 0.0));
    textureStore(densityOut, writePos, dens);
}
