struct Camera {
    viewProjection: mat4x4<f32>,
    settings: vec4<f32>,
    detailSettings: vec4<f32>,
};

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec4<f32>,
    @location(3) patternCoordinate: vec2<f32>,
    @location(4) patternMask: f32,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) color: vec4<f32>,
    @location(2) patternCoordinate: vec2<f32>,
    @location(3) patternMask: f32,
};

@group(0) @binding(0) var<uniform> camera: Camera;

// Vent grill layout in world units. Pattern x is measured from the wall's
// horizontal center and pattern y from the wall's base.
const grillCenter = vec2<f32>(0.0, 1.75);
const grillHalfSize = vec2<f32>(0.5, 0.3);
const grillFrameWidth = 0.05;
const slotPitch = 0.1;
const slotOpening = 0.5;

// Utility: signed distance to a rectangle; negative values are inside.
fn rectangleDistance(point: vec2<f32>, halfSize: vec2<f32>) -> f32 {
    let outside = abs(point) - halfSize;
    return length(max(outside, vec2<f32>(0.0))) + min(max(outside.x, outside.y), 0.0);
}

// Utility: convert a signed edge distance into soft pixel coverage.
fn insideCoverage(signedDistance: f32, width: f32) -> f32 {
    return 1.0 - smoothstep(-width, width, signedDistance);
}

// Utility: use derivatives to soften edges only when the option is enabled.
fn edgeWidth(value: f32) -> f32 {
    let filteredWidth = max(fwidth(value), 0.0005);
    return select(0.0005, filteredWidth, camera.detailSettings.x > 0.5);
}

// Shader step: calculate the ordinary wall color and optional directional light.
fn baseSurfaceColor(color: vec4<f32>, normal: vec3<f32>) -> vec3<f32> {
    let lightDirection = normalize(vec3<f32>(0.45, 0.82, 0.36));
    let diffuse = max(dot(normalize(normal), lightDirection), 0.0);
    let illumination = 0.34 + 0.66 * diffuse;
    return mix(color.rgb, color.rgb * illumination, camera.settings.y);
}

struct GrillCoverage {
    outer: f32,
    interior: f32,
};

// Shader step: find the outside and inside edges of the grill frame.
fn grillCoverage(point: vec2<f32>) -> GrillCoverage {
    let outerDistance = rectangleDistance(point, grillHalfSize);
    let innerDistance = rectangleDistance(point, grillHalfSize - vec2<f32>(grillFrameWidth));
    let width = edgeWidth(outerDistance);
    var coverage: GrillCoverage;
    coverage.outer = insideCoverage(outerDistance, width);
    coverage.interior = insideCoverage(innerDistance, width);
    return coverage;
}

// Shader step: repeat the openings vertically with fract().
fn repeatingSlotCoverage(point: vec2<f32>) -> f32 {
    let slotCell = (point.y + grillHalfSize.y - grillFrameWidth) / slotPitch;
    let slotPosition = fract(slotCell);
    let slotPixelWidth = edgeWidth(slotCell);
    let slotEdgeDistance = abs(slotPosition - 0.5) - slotOpening * 0.5;
    let sharpCoverage = insideCoverage(slotEdgeDistance, slotPixelWidth);
    let slotDetail = 1.0 - smoothstep(0.3, 0.6, slotPixelWidth);
    let filteredCoverage = mix(slotOpening, sharpCoverage, slotDetail);
    return filteredCoverage * camera.settings.w;
}

// Shader step: shade openings and slats; the optional gradients suggest depth.
fn shadeGrillInterior(point: vec2<f32>, slotCoverage: f32, baseColor: vec3<f32>) -> vec3<f32> {
    let slotCell = (point.y + grillHalfSize.y - grillFrameWidth) / slotPitch;
    let slotPosition = fract(slotCell);
    let slotPixelWidth = edgeWidth(slotCell);
    let slotDetail = 1.0 - smoothstep(0.3, 0.6, slotPixelWidth);
    let openingHeight = clamp((slotPosition - (0.5 - slotOpening * 0.5)) / slotOpening, 0.0, 1.0);
    let slatHeight = clamp(fract(slotPosition - (0.5 + slotOpening * 0.5)) / (1.0 - slotOpening), 0.0, 1.0);
    let openingDepth = mix(0.24, 0.06, openingHeight);
    let slatDepth = 0.78 + 0.24 * slatHeight;
    let openingShade = mix(0.15, mix(0.15, openingDepth, slotDetail), camera.detailSettings.y);
    let slatShade = mix(0.9, mix(0.9, slatDepth, slotDetail), camera.detailSettings.y);
    return baseColor * mix(slatShade, openingShade, slotCoverage);
}

// Shader step: add the frame's gentle top-to-bottom shading when enabled.
fn shadeGrillFrame(point: vec2<f32>, baseColor: vec3<f32>) -> vec3<f32> {
    let frameShade = 1.12 + 0.18 * clamp(point.y / grillHalfSize.y, -1.0, 1.0);
    let selectedShade = mix(1.0, frameShade, camera.settings.z);
    return baseColor * selectedShade;
}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.position = camera.viewProjection * vec4<f32>(input.position, 1.0);
    output.normal = input.normal;
    output.color = input.color;
    output.patternCoordinate = input.patternCoordinate;
    output.patternMask = input.patternMask;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    // Main function: run each named step, then blend the pattern over the wall.
    let baseColor = baseSurfaceColor(input.color, input.normal);
    let grillPoint = input.patternCoordinate - grillCenter;
    let shape = grillCoverage(grillPoint);
    let slotCoverage = repeatingSlotCoverage(grillPoint);
    let frameColor = shadeGrillFrame(grillPoint, baseColor);
    let interiorColor = shadeGrillInterior(grillPoint, slotCoverage, baseColor);
    let frameEnabled = camera.settings.z;
    let interiorCoverage = mix(1.0, shape.interior, frameEnabled);
    let grillColor = mix(frameColor, interiorColor, interiorCoverage);
    let enabled = select(0.0, 1.0, input.patternMask > 0.5 && camera.settings.x > 0.5);
    let color = mix(baseColor, grillColor, shape.outer * enabled);
    return vec4<f32>(color, input.color.a);
}
