// Appended to the SDF file: shares materials, lighting, AO, and background.
struct ShadowSettings {
    mainMatrix: mat4x4<f32>,
    localMatrix: mat4x4<f32>,
    resolution: vec4<f32>,
};
@group(1) @binding(0) var<uniform> shadowSettings: ShadowSettings;
@group(1) @binding(1) var mainDepth: texture_depth_2d;
@group(1) @binding(2) var localDepth: texture_depth_2d;
@group(1) @binding(3) var depthSampler: sampler_comparison;

struct MeshOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) world: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) @interpolate(flat) material: f32,
};

fn mappedVisibility(point: vec3<f32>, main: bool) -> f32 {
    var clip = shadowSettings.localMatrix * vec4<f32>(point, 1.0);
    if main {
        clip = shadowSettings.mainMatrix * vec4<f32>(point, 1.0);
    }
    let projected = clip.xyz / clip.w;
    let uv = vec2<f32>(projected.x * 0.5 + 0.5, 0.5 - projected.y * 0.5);
    // Outside the local map is outside the downward hemisphere used by its beam.
    if clip.w <= 0.0 || projected.z < 0.0 || projected.z > 1.0 ||
        any(uv < vec2<f32>(0.0)) || any(uv > vec2<f32>(1.0)) {
        return select(minimumShadowVisibility, 1.0, main);
    }
    let radius = select(0.0, min(camera.lightSettings.x * 16.0, 4.0), camera.lightSettings.x > 0.0);
    var visibility = 0.0;
    for (var y = -1; y <= 1; y += 1) {
        for (var x = -1; x <= 1; x += 1) {
            let sampleUV = uv + vec2<f32>(f32(x), f32(y)) * radius / shadowSettings.resolution.x;
            if main {
                visibility += textureSampleCompareLevel(mainDepth, depthSampler, sampleUV, projected.z - 0.0003);
            } else {
                visibility += textureSampleCompareLevel(localDepth, depthSampler, sampleUV, projected.z - 0.0003);
            }
        }
    }
    return mix(minimumShadowVisibility, 1.0, visibility / 9.0);
}

fn shadowVisibility(point: vec3<f32>, direction: vec3<f32>, maximumTravel: f32, includeFixture: bool) -> f32 {
    return mappedVisibility(point, includeFixture);
}

@vertex
fn meshVertexMain(@location(0) position: vec3<f32>, @location(1) normal: vec3<f32>,
    @location(2) material: f32, @location(3) fixture: f32) -> MeshOutput {
    var output: MeshOutput;
    output.world = position + lightMotionOffset() * fixture;
    output.position = camera.viewProjection * vec4<f32>(output.world, 1.0);
    output.normal = normal;
    output.material = material;
    return output;
}

@fragment
fn meshFragmentMain(input: MeshOutput) -> @location(0) vec4<f32> {
    let direction = normalize(input.world - camera.eye.xyz);
    var hit: RayHit;
    hit.hit = true;
    hit.ground = false;
    hit.distance = length(input.world - camera.eye.xyz);
    hit.position = input.world;
    if hit.distance > maximumWallDistance { discard; }
    var normal = -direction;
    if camera.detailSettings.w > 0.5 { normal = input.normal; }
    return vec4<f32>(shadeSurface(hit, direction, normal, input.material), 1.0);
}

struct FloorOutput {
    @location(0) color: vec4<f32>,
    @builtin(frag_depth) depth: f32,
};

@fragment
fn meshFloorMain(@builtin(position) fragmentPosition: vec4<f32>) -> FloorOutput {
    let screen = vec2<f32>(fragmentPosition.x / camera.viewport.x * 2.0 - 1.0,
        1.0 - fragmentPosition.y / camera.viewport.y * 2.0);
    let direction = normalize(camera.forward.xyz +
        camera.right.xyz * screen.x * camera.viewport.z * tan(0.3926991) +
        camera.up.xyz * screen.y * tan(0.3926991));
    var output: FloorOutput;
    output.color = vec4<f32>(backgroundColor(direction), 1.0);
    output.depth = 1.0;
    if camera.viewport.w > 0.5 {
        output.color = vec4<f32>(direction * 0.5 + vec3<f32>(0.5), 1.0);
        return output;
    }
    if direction.y < -0.0001 && camera.detailSettings.z > 0.5 {
        let distance = -camera.eye.y / direction.y;
        if distance > 0.0 && distance < maximumWallDistance {
            var hit: RayHit;
            hit.hit = true;
            hit.ground = true;
            hit.distance = distance;
            hit.position = camera.eye.xyz + direction * distance;
            let clip = camera.viewProjection * vec4<f32>(hit.position, 1.0);
            output.depth = clip.z / clip.w;
            output.color = vec4<f32>(shadeSurface(hit, direction, vec3<f32>(0.0, 1.0, 0.0), 0.0), 1.0);
        }
    }
    return output;
}

@vertex
fn shadowVertexMain(@location(0) position: vec3<f32>, @location(3) fixture: f32) -> @builtin(position) vec4<f32> {
    return camera.viewProjection * vec4<f32>(position + lightMotionOffset() * fixture, 1.0);
}
