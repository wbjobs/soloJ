@group(0) @binding(0) var<storage, read_write> params: vec4<f32>;
@group(0) @binding(1) var velocity: texture_2d<f32>;
@group(0) @binding(2) var divergenceOut: texture_storage_2d<r32float, write>;

var<private> invResolution: f32;
var<private> halfInvRes: f32;

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

fn sampleVelocityClamped(uv: vec2<f32>) -> vec2<f32> {
    let clampedUV = clamp(uv, vec2<f32>(halfInvRes), vec2<f32>(1.0 - halfInvRes));
    let v = textureSampleLevel(velocity, sampler, clampedUV, 0.0).xy;
    return vec2<f32>(safeFloat(v.x), safeFloat(v.y));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let resolution = params.x;
    invResolution = 1.0 / resolution;
    halfInvRes = 0.5 * invResolution;

    if (id.x >= u32(resolution) || id.y >= u32(resolution)) {
        return;
    }

    let texel = vec2<f32>(f32(id.x), f32(id.y));
    let uv = texel * invResolution + halfInvRes;

    let offset = vec2<f32>(invResolution, 0.0);

    let isBoundaryX = id.x == 0u || id.x >= u32(resolution) - 1u;
    let isBoundaryY = id.y == 0u || id.y >= u32(resolution) - 1u;

    if (isBoundaryX || isBoundaryY) {
        let writePos = vec2<i32>(i32(id.x), i32(id.y));
        textureStore(divergenceOut, writePos, vec4<f32>(0.0, 0.0, 0.0, 0.0));
        return;
    }

    let velRight = sampleVelocityClamped(uv + offset);
    let velLeft = sampleVelocityClamped(uv - offset);
    let velUp = sampleVelocityClamped(uv + offset.yx);
    let velDown = sampleVelocityClamped(uv - offset.yx);

    let div = 0.5 * resolution * (
        (velRight.x - velLeft.x) +
        (velUp.y - velDown.y)
    );

    let writePos = vec2<i32>(i32(id.x), i32(id.y));
    textureStore(divergenceOut, writePos, vec4<f32>(safeFloat(div), 0.0, 0.0, 0.0));
}
