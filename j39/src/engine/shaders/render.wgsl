@group(0) @binding(0) var<storage, read_write> params: vec4<f32>;
@group(0) @binding(1) var density: texture_2d<f32>;
@group(0) @binding(2) var velocity: texture_2d<f32>;

var<sample_type> sampler: sampler;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var out: VertexOutput;
    var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0)
    );
    var uv = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(0.0, 0.0),
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(1.0, 0.0)
    );
    out.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
    out.uv = uv[vertexIndex];
    return out;
}

fn hsv2rgb(hsv: vec3<f32>) -> vec3<f32> {
    let h = hsv.x;
    let s = hsv.y;
    let v = hsv.z;

    let c = v * s;
    let hPrime = h * 6.0;
    let x = c * (1.0 - abs((hPrime % 2.0) - 1.0));
    let m = v - c;

    var rgb: vec3<f32>;

    switch u32(hPrime) {
        case 0u: { rgb = vec3<f32>(c, x, 0.0); }
        case 1u: { rgb = vec3<f32>(x, c, 0.0); }
        case 2u: { rgb = vec3<f32>(0.0, c, x); }
        case 3u: { rgb = vec3<f32>(0.0, x, c); }
        case 4u: { rgb = vec3<f32>(x, 0.0, c); }
        default: { rgb = vec3<f32>(c, 0.0, x); }
    }

    return rgb + m;
}

fn applyColorMap(value: f32) -> vec3<f32> {
    let clampedValue = clamp(value, 0.0, 1.0);

    let numStops = 5u;
    var positions = array<f32, 5>(0.0, 0.25, 0.5, 0.75, 1.0);
    var colors = array<vec3<f32>, 5>(
        vec3<f32>(0.0, 0.0, 0.1),
        vec3<f32>(0.0, 0.2, 0.6),
        vec3<f32>(0.0, 0.6, 0.8),
        vec3<f32>(0.2, 0.9, 0.6),
        vec3<f32>(1.0, 1.0, 1.0)
    );

    if (clampedValue <= positions[0]) {
        return colors[0];
    }

    for (var i = 0u; i < numStops - 1u; i = i + 1u) {
        if (clampedValue >= positions[i] && clampedValue <= positions[i + 1u]) {
            let t = (clampedValue - positions[i]) / (positions[i + 1u] - positions[i]);
            return mix(colors[i], colors[i + 1u], t);
        }
    }

    return colors[numStops - 1u];
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let flipUV = vec2<f32>(uv.x, 1.0 - uv.y);

    let densitySample = textureSampleLevel(density, sampler, flipUV, 0.0);
    let velocitySample = textureSampleLevel(velocity, sampler, flipUV, 0.0);

    let densityValue = length(densitySample.rgb);
    let alpha = clamp(densityValue * 3.0, 0.0, 1.0);

    let velMag = length(velocitySample.xy);
    let velColor = hsv2rgb(vec3<f32>(0.6 - velMag * 0.5, 0.8, 0.9));

    let densityColor = applyColorMap(densityValue * 2.0);

    let finalColor = mix(densityColor, velColor, 0.15);
    let finalAlpha = max(alpha, 0.05);

    return vec4<f32>(finalColor * finalAlpha, finalAlpha);
}
