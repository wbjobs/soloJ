@group(0) @binding(0) var<storage, read_write> params: vec4<f32>;
@group(0) @binding(1) var pressureIn: texture_2d<f32>;
@group(0) @binding(2) var divergence: texture_2d<f32>;
@group(0) @binding(3) var pressureOut: texture_storage_2d<r32float, write>;
@group(0) @binding(4) var velocityIn: texture_2d<f32>;
@group(0) @binding(5) var velocityOut: texture_storage_2d<rg32float, write>;

var<private> invResolution: f32;
var<private> halfInvRes: f32;

var<sample_type> sampler: sampler;

fn isNan(val: f32) -> bool {
    return !(val == val);
}

fn isInf(val: f32) -> bool {
    return abs(val) == 0x1.fffffep+127f;
}

fn safeFloat(val: f32) -> f32 {
    if (isNan(val) || isInf(val)) {
        return 0.0;
    }
    return val;
}

fn samplePressureClamped(uv: vec2<f32>) -> f32 {
    let clampedUV = clamp(uv, vec2<f32>(halfInvRes), vec2<f32>(1.0 - halfInvRes));
    let val = textureSampleLevel(pressureIn, sampler, clampedUV, 0.0).x;
    return safeFloat(val);
}

@compute @workgroup_size(8, 8)
fn jacobiIteration(@builtin(global_invocation_id) id: vec3<u32>) {
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
        let boundaryVal = samplePressureClamped(uv);
        let writePos = vec2<i32>(i32(id.x), i32(id.y));
        textureStore(pressureOut, writePos, vec4<f32>(boundaryVal, 0.0, 0.0, 0.0));
        return;
    }

    let pLeft = samplePressureClamped(uv - offset);
    let pRight = samplePressureClamped(uv + offset);
    let pDown = samplePressureClamped(uv - offset.yx);
    let pUp = samplePressureClamped(uv + offset.yx);

    let div = safeFloat(textureSampleLevel(divergence, sampler, uv, 0.0).x);

    let dx = invResolution;
    let alpha = -(dx * dx);
    let beta = 4.0;

    var pressure = (pLeft + pRight + pDown + pUp + alpha * div) / beta;

    pressure = clamp(pressure, -1e4, 1e4);
    pressure = safeFloat(pressure);

    let writePos = vec2<i32>(i32(id.x), i32(id.y));
    textureStore(pressureOut, writePos, vec4<f32>(pressure, 0.0, 0.0, 0.0));
}

@compute @workgroup_size(8, 8)
fn subtractGradient(@builtin(global_invocation_id) id: vec3<u32>) {
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

    let pCenter = samplePressureClamped(uv);
    let pLeft = samplePressureClamped(uv - offset);
    let pRight = samplePressureClamped(uv + offset);
    let pDown = samplePressureClamped(uv - offset.yx);
    let pUp = samplePressureClamped(uv + offset.yx);

    var gradP = vec2<f32>(0.0, 0.0);

    if (isBoundaryX || isBoundaryY) {
        gradP = vec2<f32>(0.0, 0.0);
    } else {
        gradP = vec2<f32>(
            pRight - pLeft,
            pUp - pDown
        ) * 0.5 * resolution;
    }

    let vel = textureSampleLevel(velocityIn, sampler, uv, 0.0).xy;
    var newVel = vel - gradP;

    newVel = vec2<f32>(safeFloat(newVel.x), safeFloat(newVel.y));
    newVel = clamp(newVel, vec2<f32>(-1e3), vec2<f32>(1e3));

    let writePos = vec2<i32>(i32(id.x), i32(id.y));
    textureStore(velocityOut, writePos, vec4<f32>(newVel, 0.0, 0.0));
}
