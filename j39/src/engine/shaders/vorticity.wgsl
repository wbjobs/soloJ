@group(0) @binding(0) var<storage, read_write> params: vec4<f32>;
@group(0) @binding(1) var velocityIn: texture_2d<f32>;
@group(0) @binding(2) var vorticityTex: texture_2d<f32>;
@group(0) @binding(3) var vorticityOut: texture_storage_2d<r32float, write>;
@group(0) @binding(4) var velocityOut: texture_storage_2d<rg32float, write>;

var<private> invResolution: f32;
var<private> halfInvRes: f32;
var<private> epsilon: f32;
var<private> vorticityConfinement: f32;
var<private> dt: f32;

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

@compute @workgroup_size(8, 8)
fn computeVorticity(@builtin(global_invocation_id) id: vec3<u32>) {
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
        textureStore(vorticityOut, writePos, vec4<f32>(0.0, 0.0, 0.0, 0.0));
        return;
    }

    let clampedL = clamp(uv - offset, vec2<f32>(halfInvRes), vec2<f32>(1.0 - halfInvRes));
    let clampedR = clamp(uv + offset, vec2<f32>(halfInvRes), vec2<f32>(1.0 - halfInvRes));
    let clampedD = clamp(uv - offset.yx, vec2<f32>(halfInvRes), vec2<f32>(1.0 - halfInvRes));
    let clampedU = clamp(uv + offset.yx, vec2<f32>(halfInvRes), vec2<f32>(1.0 - halfInvRes));

    let velRight = textureSampleLevel(velocityIn, sampler, clampedR, 0.0).xy;
    let velLeft = textureSampleLevel(velocityIn, sampler, clampedL, 0.0).xy;
    let velUp = textureSampleLevel(velocityIn, sampler, clampedU, 0.0).xy;
    let velDown = textureSampleLevel(velocityIn, sampler, clampedD, 0.0).xy;

    let dudy = safeFloat(velUp.y - velDown.y);
    let dvdx = safeFloat(velRight.x - velLeft.x);

    let vorticity = safeFloat(dvdx - dudy);

    let writePos = vec2<i32>(i32(id.x), i32(id.y));
    textureStore(vorticityOut, writePos, vec4<f32>(vorticity, 0.0, 0.0, 0.0));
}

@compute @workgroup_size(8, 8)
fn applyConfinement(@builtin(global_invocation_id) id: vec3<u32>) {
    let resolution = params.x;
    invResolution = 1.0 / resolution;
    halfInvRes = 0.5 * invResolution;
    epsilon = params.y;
    vorticityConfinement = params.z;
    dt = params.w;

    if (id.x >= u32(resolution) || id.y >= u32(resolution)) {
        return;
    }

    let texel = vec2<f32>(f32(id.x), f32(id.y));
    let uv = texel * invResolution + halfInvRes;

    let offset = vec2<f32>(invResolution, 0.0);

    let isBoundaryX = id.x == 0u || id.x >= u32(resolution) - 1u;
    let isBoundaryY = id.y == 0u || id.y >= u32(resolution) - 1u;

    if (isBoundaryX || isBoundaryY) {
        let centerVel = textureSampleLevel(velocityIn, sampler, uv, 0.0).xy;
        let writePos = vec2<i32>(i32(id.x), i32(id.y));
        textureStore(velocityOut, writePos, vec4<f32>(centerVel, 0.0, 0.0));
        return;
    }

    let clampedL = clamp(uv - offset, vec2<f32>(halfInvRes), vec2<f32>(1.0 - halfInvRes));
    let clampedR = clamp(uv + offset, vec2<f32>(halfInvRes), vec2<f32>(1.0 - halfInvRes));
    let clampedD = clamp(uv - offset.yx, vec2<f32>(halfInvRes), vec2<f32>(1.0 - halfInvRes));
    let clampedU = clamp(uv + offset.yx, vec2<f32>(halfInvRes), vec2<f32>(1.0 - halfInvRes));

    let vortRight = safeFloat(textureSampleLevel(vorticityTex, sampler, clampedR, 0.0).x);
    let vortLeft = safeFloat(textureSampleLevel(vorticityTex, sampler, clampedL, 0.0).x);
    let vortUp = safeFloat(textureSampleLevel(vorticityTex, sampler, clampedU, 0.0).x);
    let vortDown = safeFloat(textureSampleLevel(vorticityTex, sampler, clampedD, 0.0).x);

    let vorticityGrad = vec2<f32>(
        abs(vortRight) - abs(vortLeft),
        abs(vortUp) - abs(vortDown)
    ) * 0.5;

    let gradMag = length(vorticityGrad) + epsilon;
    let normalizedGrad = vorticityGrad / gradMag;

    let vorticity = safeFloat(textureSampleLevel(vorticityTex, sampler, uv, 0.0).x);
    let force = vec2<f32>(normalizedGrad.y, -normalizedGrad.x) * vorticity * vorticityConfinement;

    let clampedForce = clamp(force, vec2<f32>(-1e3), vec2<f32>(1e3));

    let centerVel = textureSampleLevel(velocityIn, sampler, uv, 0.0).xy;
    var newVel = centerVel + clampedForce * dt;

    newVel = vec2<f32>(safeFloat(newVel.x), safeFloat(newVel.y));
    newVel = clamp(newVel, vec2<f32>(-1e3), vec2<f32>(1e3));

    let writePos = vec2<i32>(i32(id.x), i32(id.y));
    textureStore(velocityOut, writePos, vec4<f32>(newVel, 0.0, 0.0));
}
