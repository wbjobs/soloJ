@group(0) @binding(0) var<storage, read_write> params: vec4<f32>;
@group(0) @binding(1) var velocityIn: texture_2d<f32>;
@group(0) @binding(2) var velocityOut: texture_storage_2d<rg32float, write>;
@group(0) @binding(3) var densityIn: texture_2d<f32>;
@group(0) @binding(4) var densityOut: texture_storage_2d<rgba32float, write>;

var<private> invResolution: f32;
var<private> halfInvRes: f32;
var<private> dt: f32;
var<private> dissipationVel: f32;
var<private> dissipationDens: f32;

var<sample_type> sampler: sampler;

fn isNan(val: f32) -> bool {
    return !(val == val);
}

fn safeFloat(val: f32) -> f32 {
    if (isNan(val) || abs(val) > 1e6) {
        return 0.0;
    }
    return val;
}

fn safeVec2(v: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(safeFloat(v.x), safeFloat(v.y));
}

fn sampleVelocity(uv: vec2<f32>) -> vec2<f32> {
    let clampedUV = clamp(uv, vec2<f32>(halfInvRes), vec2<f32>(1.0 - halfInvRes));
    return safeVec2(textureSampleLevel(velocityIn, sampler, clampedUV, 0.0).xy);
}

fn sampleDensity(uv: vec2<f32>) -> vec4<f32> {
    let clampedUV = clamp(uv, vec2<f32>(halfInvRes), vec2<f32>(1.0 - halfInvRes));
    let d = textureSampleLevel(densityIn, sampler, clampedUV, 0.0);
    return vec4<f32>(safeFloat(d.x), safeFloat(d.y), safeFloat(d.z), safeFloat(d.w));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let resolution = params.x;
    invResolution = 1.0 / resolution;
    halfInvRes = 0.5 * invResolution;
    dt = params.y;
    dissipationVel = params.z;
    dissipationDens = params.w;

    if (id.x >= u32(resolution) || id.y >= u32(resolution)) {
        return;
    }

    let texel = vec2<f32>(f32(id.x), f32(id.y));
    let uv = texel * invResolution + halfInvRes;

    let vel = sampleVelocity(uv);

    let prevPos = uv - vel * dt * invResolution;

    let minPos = vec2<f32>(halfInvRes);
    let maxPos = vec2<f32>(1.0 - halfInvRes);
    let clampedPrevPos = clamp(prevPos, minPos, maxPos);

    let advectedVel = sampleVelocity(clampedPrevPos) * dissipationVel;
    let advectedDens = sampleDensity(clampedPrevPos) * dissipationDens;

    let writePos = vec2<i32>(i32(id.x), i32(id.y));
    textureStore(velocityOut, writePos, vec4<f32>(clamp(advectedVel, vec2<f32>(-1e3), vec2<f32>(1e3)), 0.0, 0.0));
    textureStore(densityOut, writePos, clamp(advectedDens, vec4<f32>(0.0), vec4<f32>(10.0)));
}
