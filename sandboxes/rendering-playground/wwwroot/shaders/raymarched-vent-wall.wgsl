struct RayCamera {
    viewProjection: mat4x4<f32>,
    eye: vec4<f32>,
    forward: vec4<f32>,
    right: vec4<f32>,
    up: vec4<f32>,
    viewport: vec4<f32>,
    settings: vec4<f32>,
    detailSettings: vec4<f32>,
    lightSettings: vec4<f32>,
    hatchSettings: vec4<f32>,
    accentSettings: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
};

struct RayHit {
    hit: bool,
    ground: bool,
    distance: f32,
    position: vec3<f32>,
};

@group(0) @binding(0) var<uniform> camera: RayCamera;

const wallCenter = vec3<f32>(0.0, 1.2, 0.0);
const ventCenter = vec3<f32>(0.0, 1.75, 0.0);
const maximumWallDistance = 32.0;
const wallBoundRadius = 3.0;
const surfaceEpsilon = 0.0015;
const mainShadowContributionCutoff = 0.05;
const minimumShadowVisibility = 0.18;
const moduleOffset = 1.3;
const hatchCenter = vec3<f32>(0.0, 0.72, 0.0);
const overheadLightPosition = vec3<f32>(moduleOffset, 1.225, 0.18);

fn lightMotionOffset() -> vec3<f32> {
    return vec3<f32>(clamp(camera.accentSettings.z, -0.32, 0.32), 0.0, 0.0);
}

// Utility: signed distance to an axis-aligned box.
fn boxDistance(point: vec3<f32>, halfSize: vec3<f32>) -> f32 {
    let outside = abs(point) - halfSize;
    return length(max(outside, vec3<f32>(0.0))) +
        min(max(outside.x, max(outside.y, outside.z)), 0.0);
}

// Utility: combine two signed-distance fields as a union.
fn unionDistance(first: f32, second: f32) -> f32 {
    return min(first, second);
}

// Utility: subtract the second shape from the first.
fn subtractDistance(base: f32, cutout: f32) -> f32 {
    return max(base, -cutout);
}

// Shader step: carve the grill opening through the wall's thickness.
fn wallBodyDistance(point: vec3<f32>) -> f32 {
    var body = boxDistance(point - wallCenter, vec3<f32>(1.0, 1.2, 0.07));
    if camera.settings.x > 0.5 {
        let opening = boxDistance(point - ventCenter, vec3<f32>(0.455, 0.25, 0.2));
        body = subtractDistance(body, opening);
    }
    return body;
}

// Shader step: build the raised border from four mathematical box primitives.
fn frameDistance(point: vec3<f32>) -> f32 {
    let local = point - ventCenter;
    let sides = unionDistance(
        boxDistance(local - vec3<f32>(-0.475, 0.0, 0.09), vec3<f32>(0.025, 0.3, 0.05)),
        boxDistance(local - vec3<f32>(0.475, 0.0, 0.09), vec3<f32>(0.025, 0.3, 0.05)),
    );
    let rails = unionDistance(
        boxDistance(local - vec3<f32>(0.0, -0.275, 0.09), vec3<f32>(0.475, 0.025, 0.05)),
        boxDistance(local - vec3<f32>(0.0, 0.275, 0.09), vec3<f32>(0.475, 0.025, 0.05)),
    );
    return unionDistance(sides, rails);
}

// Shader step: join the horizontal slats into the carved-through opening.
fn slatDistance(point: vec3<f32>) -> f32 {
    let local = point - ventCenter;
    var distance = 1e6;
    for (var index = 0; index < 6; index += 1) {
        let height = -0.25 + f32(index) * 0.1;
        let slat = boxDistance(
            local - vec3<f32>(0.0, height, 0.09),
            vec3<f32>(0.45, 0.018, 0.05),
        );
        distance = unionDistance(distance, slat);
    }
    return distance;
}

// Utility: carry the winning surface's material alongside its distance.
fn nearestSurface(first: vec2<f32>, second: vec2<f32>) -> vec2<f32> {
    if second.x < first.x {
        return second;
    }
    return first;
}

// Shader step: cut a shallow pocket, then fill it with a flush or inset plate.
fn hatchSurface(point: vec3<f32>, recessed: bool, body: f32) -> vec2<f32> {
    let pocket = boxDistance(
        point - hatchCenter - vec3<f32>(0.0, 0.0, 0.07),
        vec3<f32>(0.54, 0.47, 0.065),
    );
    let wall = subtractDistance(body, pocket);
    var plateCenterZ = 0.0375;
    var plateHalfDepth = 0.0325;
    if recessed {
        plateCenterZ = 0.02;
        plateHalfDepth = 0.015;
    }
    let plate = boxDistance(
        point - hatchCenter - vec3<f32>(0.0, 0.0, plateCenterZ),
        vec3<f32>(0.52, 0.45, plateHalfDepth),
    );
    return nearestSurface(vec2<f32>(wall, 0.0), vec2<f32>(plate, 2.0));
}

// Shader step: control housing, screen, and three mathematical buttons.
fn controlPanelSurface(point: vec3<f32>) -> vec2<f32> {
    let local = point - vec3<f32>(0.77, 0.78, 0.0);
    var surface = vec2<f32>(
        boxDistance(local - vec3<f32>(0.0, 0.0, 0.087), vec3<f32>(0.13, 0.22, 0.027)),
        1.0,
    );
    surface = nearestSurface(surface, vec2<f32>(
        boxDistance(local - vec3<f32>(0.0, 0.065, 0.115), vec3<f32>(0.105, 0.12, 0.005)),
        3.0,
    ));
    for (var index = 0; index < 3; index += 1) {
        let buttonX = -0.07 + f32(index) * 0.07;
        surface = nearestSurface(surface, vec2<f32>(
            boxDistance(local - vec3<f32>(buttonX, -0.135, 0.118), vec3<f32>(0.024, 0.025, 0.008)),
            4.0,
        ));
    }
    return surface;
}

// Shader step: a projecting overhead housing and a luminous underside strip.
fn overheadFixtureSurface(point: vec3<f32>) -> vec2<f32> {
    let local = point - lightMotionOffset();
    let housing = boxDistance(
        local - vec3<f32>(0.0, 1.29, 0.15), vec3<f32>(0.56, 0.045, 0.10),
    );
    let strip = boxDistance(
        local - vec3<f32>(0.0, 1.24, 0.18), vec3<f32>(0.48, 0.008, 0.055),
    );
    return nearestSurface(vec2<f32>(housing, 1.0), vec2<f32>(strip, 5.0));
}

fn hatchClutterSurface(point: vec3<f32>) -> vec2<f32> {
    var surface = vec2<f32>(
        boxDistance(point - vec3<f32>(0.0, 1.10, 0.17), vec3<f32>(0.46, 0.028, 0.055)), 6.0);
    for (var index = 0; index < 2; index += 1) {
        let x = select(-0.34, 0.30, index == 1);
        surface = nearestSurface(surface, vec2<f32>(
            boxDistance(point - vec3<f32>(x, 0.92, 0.185), vec3<f32>(0.025, 0.18, 0.05)), 6.0));
        surface = nearestSurface(surface, vec2<f32>(
            boxDistance(point - vec3<f32>(x, 1.10, 0.17), vec3<f32>(0.042, 0.045, 0.07)), 6.0));
        let mountX = select(-0.43, 0.43, index == 1);
        surface = nearestSurface(surface, vec2<f32>(
            boxDistance(point - vec3<f32>(mountX, 1.10, 0.095), vec3<f32>(0.03, 0.06, 0.045)), 1.0));
    }
    return surface;
}

fn greebleDistance(point: vec3<f32>) -> f32 {
    let count = camera.lightSettings.w;
    if count < 1.0 { return 1e6; }
    let columns = sqrt(count * 2.0);
    let rows = columns * 0.5;
    let spacing = vec2<f32>(1.76 / columns, 0.3 / rows);
    let origin = vec2<f32>(-0.88, 2.08) + spacing * 0.5;
    let cell = clamp(round((point.xy - origin) / spacing), vec2<f32>(0.0),
        vec2<f32>(columns - 1.0, rows - 1.0));
    let center = vec3<f32>(origin + cell * spacing, 0.09);
    return boxDistance(point - center, vec3<f32>(spacing * 0.28, 0.03));
}

// Shader step: assemble one module, constrained to a fixed detail envelope.
fn moduleSurface(point: vec3<f32>, recessed: bool, includeFixture: bool) -> vec2<f32> {
    var surface = vec2<f32>(wallBodyDistance(point), 0.0);
    let hatchEnabled = select(camera.hatchSettings.x, camera.hatchSettings.y, recessed);
    if hatchEnabled > 0.5 {
        surface = hatchSurface(point, recessed, surface.x);
    }
    if camera.settings.y > 0.5 {
        surface = nearestSurface(surface, vec2<f32>(frameDistance(point), 1.0));
    }
    if camera.settings.z > 0.5 {
        surface = nearestSurface(surface, vec2<f32>(slatDistance(point), 1.0));
    }
    if recessed && camera.hatchSettings.z > 0.5 {
        surface = nearestSurface(surface, controlPanelSurface(point));
    }
    if recessed && includeFixture && camera.hatchSettings.w > 0.5 {
        surface = nearestSurface(surface, overheadFixtureSurface(point));
    }
    if recessed && camera.right.w > 0.5 {
        surface = nearestSurface(surface, hatchClutterSurface(point));
    }
    surface = nearestSurface(surface, vec2<f32>(greebleDistance(point), 1.0));
    let envelope = boxDistance(
        point - vec3<f32>(0.0, 1.2, 0.1), vec3<f32>(1.0, 1.2, 0.17),
    );
    surface.x = max(surface.x, envelope);
    return surface;
}

fn sceneSurfaceWithFixture(point: vec3<f32>, includeFixture: bool) -> vec2<f32> {
    let flush = moduleSurface(point + vec3<f32>(moduleOffset, 0.0, 0.0), false, includeFixture);
    let recessed = moduleSurface(point - vec3<f32>(moduleOffset, 0.0, 0.0), true, includeFixture);
    return nearestSurface(flush, recessed);
}

fn sceneSurface(point: vec3<f32>) -> vec2<f32> {
    return sceneSurfaceWithFixture(point, true);
}

fn sceneDistance(point: vec3<f32>) -> f32 {
    return sceneSurface(point).x;
}

// Shader step: march only inside a bounding sphere around both wall modules.
fn marchWall(origin: vec3<f32>, direction: vec3<f32>) -> RayHit {
    let toCenter = origin - wallCenter;
    let projected = dot(toCenter, direction);
    let offsetSquared = dot(toCenter, toCenter) - projected * projected;
    let radiusSquared = wallBoundRadius * wallBoundRadius;
    let remaining = radiusSquared - offsetSquared;
    var result: RayHit;
    result.hit = false;
    result.ground = false;
    result.distance = maximumWallDistance;
    result.position = vec3<f32>(0.0);
    if remaining < 0.0 {
        return result;
    }

    let halfChord = sqrt(remaining);
    let entry = max(0.0, -projected - halfChord);
    let exit = -projected + halfChord;
    var travel = entry;
    for (var step = 0; step < 72; step += 1) {
        let point = origin + direction * travel;
        let distance = sceneDistance(point);
        if distance < surfaceEpsilon {
            result.hit = true;
            result.distance = travel;
            result.position = point;
            return result;
        }
        travel += max(distance, surfaceEpsilon);
        if travel > exit {
            return result;
        }
    }
    return result;
}

// Shader step: estimate the SDF surface normal with central differences.
fn estimateNormal(point: vec3<f32>) -> vec3<f32> {
    let offset = 0.001;
    let x = vec3<f32>(offset, 0.0, 0.0);
    let y = vec3<f32>(0.0, offset, 0.0);
    let z = vec3<f32>(0.0, 0.0, offset);
    return normalize(vec3<f32>(
        sceneDistance(point + x) - sceneDistance(point - x),
        sceneDistance(point + y) - sceneDistance(point - y),
        sceneDistance(point + z) - sceneDistance(point - z),
    ));
}

// Shader step: stop at the light rather than letting geometry behind it occlude it.
fn shadowVisibility(point: vec3<f32>, direction: vec3<f32>, maximumTravel: f32, includeFixture: bool) -> f32 {
    var visibility = 1.0;
    var travel = 0.02;
    let maximumSteps = select(64, 24, includeFixture);
    let minimumStep = select(0.002, 0.025, includeFixture);
    for (var step = 0; step < maximumSteps; step += 1) {
        if travel >= maximumTravel {
            break;
        }
        let distance = sceneSurfaceWithFixture(point + direction * travel, includeFixture).x;
        if distance < 0.002 {
            return minimumShadowVisibility;
        }
        // Approximate angular light size; zero keeps only the hard-hit test.
        if camera.lightSettings.x > 0.0 {
            visibility = min(visibility, distance / (camera.lightSettings.x * travel));
            if visibility <= minimumShadowVisibility {
                return minimumShadowVisibility;
            }
        }
        travel += clamp(distance, minimumStep, 0.2);
    }
    return clamp(visibility, minimumShadowVisibility, 1.0);
}

fn softShadow(point: vec3<f32>, direction: vec3<f32>) -> f32 {
    return shadowVisibility(point, direction, 4.0, true);
}

// Shader step: trace main-light shadows only where its direct contribution matters.
fn mainLightContribution(point: vec3<f32>, normal: vec3<f32>) -> f32 {
    if camera.lightSettings.y < 0.5 || camera.settings.w < 0.5 {
        return 0.0;
    }
    let direction = normalize(vec3<f32>(-0.45, 0.82, 0.6));
    var direct = 0.66 * max(dot(normal, direction), 0.0);
    if camera.detailSettings.x > 0.5 && direct >= mainShadowContributionCutoff {
        direct *= softShadow(point + normal * 0.003, direction);
    }
    return direct;
}

// Shader step: the overhead source illuminates nearby surfaces with distance falloff.
fn overheadIllumination(point: vec3<f32>, normal: vec3<f32>) -> vec3<f32> {
    if camera.hatchSettings.w < 0.5 || camera.accentSettings.y < 0.5 || camera.settings.w < 0.5 ||
        camera.lightSettings.z < 0.5 || camera.accentSettings.w <= 0.0 {
        return vec3<f32>(0.0);
    }
    let start = point + normal * 0.004;
    let toLight = overheadLightPosition + lightMotionOffset() - start;
    let lightDistance = length(toLight);
    if lightDistance < 0.02 {
        return vec3<f32>(0.0);
    }
    let direction = toLight / lightDistance;
    let diffuse = max(dot(normal, direction), 0.0);
    let beam = max(dot(-direction, normalize(vec3<f32>(0.0, -1.0, 0.35))), 0.0);
    if diffuse == 0.0 || beam == 0.0 {
        return vec3<f32>(0.0);
    }
    var visibility = 1.0;
    if camera.detailSettings.x > 0.5 && camera.up.w > 0.5 {
        // The downward emitter must not become an occluder of its own light.
        visibility = shadowVisibility(start, direction, lightDistance - 0.01, false);
    }
    let strength = 2.0 * diffuse * beam * visibility / (1.0 + 3.0 * lightDistance * lightDistance);
    return vec3<f32>(1.0, 0.78, 0.48) * strength * camera.accentSettings.w;
}

// Shader step: sample the distance field along the normal for contact shading.
fn ambientOcclusion(point: vec3<f32>, normal: vec3<f32>) -> f32 {
    var occlusion = 0.0;
    var weight = 1.0;
    for (var step = 1; step <= 4; step += 1) {
        let distanceAlongNormal = 0.025 * f32(step);
        let fieldDistance = sceneDistance(point + normal * distanceAlongNormal);
        occlusion += (distanceAlongNormal - fieldDistance) * weight;
        weight *= 0.65;
    }
    return clamp(1.0 - 2.5 * occlusion, 0.55, 1.0);
}

fn backgroundColor(direction: vec3<f32>) -> vec3<f32> {
    let vertical = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
    return mix(vec3<f32>(0.78, 0.84, 0.89), vec3<f32>(0.95, 0.97, 0.98), vertical);
}

// Shader step: shade actual SDF hits with estimated normals and optional effects.
fn shadeHit(hit: RayHit, direction: vec3<f32>) -> vec3<f32> {
    var normal = normalize(-direction);
    if hit.ground {
        // The analytically intersected floor is not part of the wall SDF.
        normal = vec3<f32>(0.0, 1.0, 0.0);
    } else if camera.detailSettings.w > 0.5 {
        normal = estimateNormal(hit.position);
    }
    let material = sceneSurface(hit.position).y;
    return shadeSurface(hit, direction, normal, material);
}

fn shadeSurface(hit: RayHit, direction: vec3<f32>, normal: vec3<f32>, material: f32) -> vec3<f32> {
    let groundColor = vec3<f32>(0.32, 0.36, 0.4);
    let wallColor = vec3<f32>(0.58, 0.66, 0.73);
    let frameColor = vec3<f32>(0.38, 0.45, 0.52);
    let isGround = hit.ground;
    var baseColor = wallColor;
    var emission = vec3<f32>(0.0);
    if isGround {
        baseColor = groundColor;
    } else {
        if material == 1.0 {
            baseColor = frameColor;
        } else if material == 2.0 {
            baseColor = vec3<f32>(0.46, 0.55, 0.62);
        } else if material == 3.0 {
            baseColor = vec3<f32>(0.03, 0.2, 0.24);
        } else if material == 4.0 {
            baseColor = vec3<f32>(0.22, 0.7, 0.65);
        } else if material == 6.0 {
            baseColor = vec3<f32>(0.42, 0.24, 0.12);
        } else if material == 5.0 {
            baseColor = vec3<f32>(0.85, 0.78, 0.6);
            if camera.accentSettings.x > 0.5 && camera.lightSettings.z > 0.5 {
                emission = vec3<f32>(1.0, 0.82, 0.5) * camera.accentSettings.w;
            }
        }
    }

    var illumination = 0.34 + mainLightContribution(hit.position, normal);
    if camera.detailSettings.y > 0.5 {
        illumination *= ambientOcclusion(hit.position, normal);
    }
    if camera.settings.w < 0.5 {
        illumination = 0.9;
    }
    let viewRim = pow(1.0 - max(dot(normal, -direction), 0.0), 3.0) * 0.12;
    return baseColor * (vec3<f32>(illumination) + overheadIllumination(hit.position, normal)) +
        vec3<f32>(viewRim) + emission;
}

@vertex
fn rayVertexMain(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    var position = vec2<f32>(-1.0, -1.0);
    if vertexIndex == 1u {
        position = vec2<f32>(3.0, -1.0);
    } else if vertexIndex == 2u {
        position = vec2<f32>(-1.0, 3.0);
    }
    return vec4<f32>(position, 0.0, 1.0);
}

@fragment
fn rayFragmentMain(@builtin(position) fragmentPosition: vec4<f32>) -> @location(0) vec4<f32> {
    let screen = vec2<f32>(
        fragmentPosition.x / camera.viewport.x * 2.0 - 1.0,
        1.0 - fragmentPosition.y / camera.viewport.y * 2.0,
    );
    let halfHeight = tan(0.3926991);
    let rayDirection = normalize(
        camera.forward.xyz +
        camera.right.xyz * screen.x * camera.viewport.z * halfHeight +
        camera.up.xyz * screen.y * halfHeight,
    );
    let rayOrigin = camera.eye.xyz;
    if camera.viewport.w > 0.5 {
        return vec4<f32>(rayDirection * 0.5 + vec3<f32>(0.5), 1.0);
    }

    var hit: RayHit;
    hit.hit = false;
    hit.ground = false;
    hit.distance = maximumWallDistance;
    hit.position = vec3<f32>(0.0);
    if camera.detailSettings.z > 0.5 {
        hit = marchWall(rayOrigin, rayDirection);
    }

    if camera.detailSettings.z > 0.5 && rayDirection.y < -0.0001 {
        let floorDistance = -rayOrigin.y / rayDirection.y;
        if floorDistance > 0.0 && floorDistance < hit.distance {
            hit.hit = true;
            hit.ground = true;
            hit.distance = floorDistance;
            hit.position = rayOrigin + rayDirection * floorDistance;
        }
    }

    if !hit.hit || hit.distance > maximumWallDistance {
        return vec4<f32>(backgroundColor(rayDirection), 1.0);
    }
    return vec4<f32>(shadeHit(hit, rayDirection), 1.0);
}
