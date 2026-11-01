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

struct RayHit {
    hit: bool,
    distance: f32,
    position: vec3<f32>,
    material: f32,
};

@group(0) @binding(0) var<uniform> camera: RayCamera;

const maximumDistance = 40.0;
const surfaceEpsilon = 0.0015;
const workLightPosition = vec3<f32>(-0.48, 2.51, 0.12);
const arcSourcePosition = vec3<f32>(1.24, 1.70, 0.16);

fn boxDistance(point: vec3<f32>, halfSize: vec3<f32>) -> f32 {
    let outside = abs(point) - halfSize;
    return length(max(outside, vec3<f32>(0.0))) + min(max(outside.x, max(outside.y, outside.z)), 0.0);
}

fn roundBoxDistance(point: vec3<f32>, halfSize: vec3<f32>, radius: f32) -> f32 {
    return boxDistance(point, halfSize - vec3<f32>(radius)) - radius;
}

fn capsuleDistance(point: vec3<f32>, start: vec3<f32>, end: vec3<f32>, radius: f32) -> f32 {
    let segment = end - start;
    let along = clamp(dot(point - start, segment) / dot(segment, segment), 0.0, 1.0);
    return length(point - start - segment * along) - radius;
}

fn nearestSurface(first: vec2<f32>, second: vec2<f32>) -> vec2<f32> {
    if second.x < first.x {
        return second;
    }
    return first;
}

// The wall, work area, service pipes, and floor are all distance fields.
fn sceneSurface(point: vec3<f32>) -> vec2<f32> {
    var surface = vec2<f32>(
        boxDistance(point - vec3<f32>(0.0, 1.40, -0.16), vec3<f32>(2.2, 1.4, 0.12)), 1.0);
    surface = nearestSurface(surface, vec2<f32>(
        boxDistance(point - vec3<f32>(0.0, -0.09, 1.0), vec3<f32>(3.0, 0.09, 3.1)), 8.0));

    // Central control station: screen and indicators are emissive surfaces, not lights.
    surface = nearestSurface(surface, vec2<f32>(
        roundBoxDistance(point - vec3<f32>(-0.28, 1.40, 0.005), vec3<f32>(0.54, 0.34, 0.07), 0.045), 3.0));
    surface = nearestSurface(surface, vec2<f32>(
        roundBoxDistance(point - vec3<f32>(-0.48, 1.43, 0.084), vec3<f32>(0.25, 0.22, 0.018), 0.018), 4.0));
    for (var index = 0; index < 4; index += 1) {
        let y = 1.64 - f32(index) * 0.14;
        let material = select(6.0, 5.0, index % 2 == 0);
        surface = nearestSurface(surface, vec2<f32>(
            roundBoxDistance(point - vec3<f32>(0.11, y, 0.09), vec3<f32>(0.045, 0.043, 0.018), 0.012), material));
    }
    surface = nearestSurface(surface, vec2<f32>(
        roundBoxDistance(point - vec3<f32>(-0.05, 1.23, 0.085), vec3<f32>(0.19, 0.035, 0.014), 0.012), 6.0));

    // Fixed overhead work light high on the wall.
    surface = nearestSurface(surface, vec2<f32>(
        roundBoxDistance(point - vec3<f32>(-0.48, 2.63, 0.025), vec3<f32>(0.52, 0.065, 0.095), 0.035), 7.0));

    // Pipe runs frame the panel opening. Several elbows and branches project farther into the room.
    surface = nearestSurface(surface, vec2<f32>(capsuleDistance(point, vec3<f32>(-1.95, 2.28, 0.34), vec3<f32>(1.82, 2.28, 0.34), 0.075), 2.0));
    surface = nearestSurface(surface, vec2<f32>(capsuleDistance(point, vec3<f32>(-1.72, 0.22, 0.31), vec3<f32>(-1.72, 2.54, 0.31), 0.09), 2.0));
    surface = nearestSurface(surface, vec2<f32>(capsuleDistance(point, vec3<f32>(-1.62, 0.46, 0.42), vec3<f32>(-0.92, 0.46, 0.42), 0.065), 2.0));
    surface = nearestSurface(surface, vec2<f32>(capsuleDistance(point, vec3<f32>(-0.92, 0.46, 0.42), vec3<f32>(-0.92, 1.03, 0.42), 0.065), 2.0));
    surface = nearestSurface(surface, vec2<f32>(capsuleDistance(point, vec3<f32>(-1.70, 0.78, 0.36), vec3<f32>(-1.18, 1.06, 0.68), 0.055), 2.0));
    surface = nearestSurface(surface, vec2<f32>(capsuleDistance(point, vec3<f32>(0.66, 0.34, 0.38), vec3<f32>(1.84, 0.34, 0.38), 0.085), 2.0));
    surface = nearestSurface(surface, vec2<f32>(capsuleDistance(point, vec3<f32>(1.78, 0.34, 0.38), vec3<f32>(1.78, 2.58, 0.38), 0.10), 2.0));
    surface = nearestSurface(surface, vec2<f32>(capsuleDistance(point, vec3<f32>(0.72, 0.83, 0.80), vec3<f32>(1.56, 0.83, 0.80), 0.11), 2.0));
    surface = nearestSurface(surface, vec2<f32>(capsuleDistance(point, vec3<f32>(0.70, 0.83, 0.80), vec3<f32>(0.70, 1.36, 0.80), 0.11), 2.0));
    surface = nearestSurface(surface, vec2<f32>(capsuleDistance(point, vec3<f32>(0.78, 1.94, 0.34), vec3<f32>(1.22, 2.18, 0.78), 0.07), 2.0));
    surface = nearestSurface(surface, vec2<f32>(capsuleDistance(point, vec3<f32>(1.22, 2.18, 0.78), vec3<f32>(1.68, 1.94, 0.78), 0.07), 2.0));
    surface = nearestSurface(surface, vec2<f32>(capsuleDistance(point, vec3<f32>(1.05, 1.48, 0.25), vec3<f32>(1.66, 1.48, 0.72), 0.055), 2.0));

    // The damaged electrical gap sits behind the right-hand pipes. Its arc is a changing SDF.
    if camera.accentSettings.z > 0.5 && camera.accentSettings.y > 0.05 {
        let time = camera.accentSettings.x;
        let jitter = 0.045 * sin(time * 83.0);
        var arc = capsuleDistance(point, vec3<f32>(1.08, 1.90, 0.15),
            vec3<f32>(1.30 + jitter, 1.76, 0.15), 0.018);
        arc = min(arc, capsuleDistance(point, vec3<f32>(1.30 + jitter, 1.76, 0.15),
            vec3<f32>(1.15 - jitter, 1.60, 0.17), 0.016));
        arc = min(arc, capsuleDistance(point, vec3<f32>(1.15 - jitter, 1.60, 0.17),
            vec3<f32>(1.34, 1.43, 0.17), 0.019));
        arc = min(arc, capsuleDistance(point, vec3<f32>(1.34, 1.43, 0.17),
            vec3<f32>(1.20 + jitter, 1.32, 0.17), 0.014));
        surface = nearestSurface(surface, vec2<f32>(arc, 9.0));
    }
    return surface;
}

fn estimateNormal(point: vec3<f32>) -> vec3<f32> {
    let e = vec2<f32>(0.0015, -0.0015);
    return normalize(
        e.xyy * sceneSurface(point + e.xyy).x +
        e.yyx * sceneSurface(point + e.yyx).x +
        e.yxy * sceneSurface(point + e.yxy).x +
        e.xxx * sceneSurface(point + e.xxx).x);
}

fn marchScene(origin: vec3<f32>, direction: vec3<f32>) -> RayHit {
    var hit = RayHit(false, maximumDistance, vec3<f32>(0.0), 0.0);
    var travel = 0.0;
    for (var step = 0; step < 100; step += 1) {
        let point = origin + direction * travel;
        let surface = sceneSurface(point);
        if surface.x < surfaceEpsilon {
            hit.hit = true;
            hit.distance = travel;
            hit.position = point;
            hit.material = surface.y;
            return hit;
        }
        travel += max(surface.x, surfaceEpsilon);
        if travel > maximumDistance {
            break;
        }
    }
    return hit;
}

fn shadowVisibility(point: vec3<f32>, direction: vec3<f32>, maximumTravel: f32) -> f32 {
    var travel = 0.018;
    for (var step = 0; step < 40; step += 1) {
        if travel >= maximumTravel {
            break;
        }
        let distance = sceneSurface(point + direction * travel).x;
        if distance < 0.003 {
            return 0.16;
        }
        travel += clamp(distance, 0.012, 0.24);
    }
    return 1.0;
}

fn localLight(point: vec3<f32>, normal: vec3<f32>, source: vec3<f32>, color: vec3<f32>, power: f32) -> vec3<f32> {
    let toLight = source - point;
    let lightDistance = length(toLight);
    let direction = toLight / max(lightDistance, 0.001);
    let diffuse = max(dot(normal, direction), 0.0);
    if diffuse <= 0.0 || power <= 0.0 {
        return vec3<f32>(0.0);
    }
    let visibility = shadowVisibility(point + normal * 0.006, direction, lightDistance - 0.025);
    return color * (power * diffuse * visibility / (1.0 + 0.9 * lightDistance * lightDistance));
}

fn surfaceColor(point: vec3<f32>, direction: vec3<f32>, material: f32) -> vec3<f32> {
    let normal = estimateNormal(point);
    let warm = localLight(point, normal, workLightPosition, vec3<f32>(1.0, 0.69, 0.38), 5.0);
    let arcPower = camera.accentSettings.y;
    let electric = localLight(point, normal, arcSourcePosition, vec3<f32>(0.25, 0.62, 1.0), arcPower * 8.0);
    var base = vec3<f32>(0.48, 0.53, 0.57);
    var emission = vec3<f32>(0.0);
    if material == 2.0 {
        base = vec3<f32>(0.20, 0.24, 0.27);
    } else if material == 3.0 {
        base = vec3<f32>(0.13, 0.16, 0.18);
    } else if material == 4.0 {
        base = vec3<f32>(0.015, 0.11, 0.18);
        emission = vec3<f32>(0.02, 0.18, 0.30);
    } else if material == 5.0 {
        base = vec3<f32>(0.28, 0.035, 0.025);
        let blink = select(0.15, 1.0, sin(camera.accentSettings.x * 12.0) > 0.35);
        emission = vec3<f32>(1.0, 0.045, 0.018) * blink * 1.8;
    } else if material == 6.0 {
        base = vec3<f32>(0.35, 0.34, 0.30);
        let blink = select(0.18, 1.0, sin(camera.accentSettings.x * 8.0 + 2.0) > 0.2);
        emission = vec3<f32>(0.85, 0.88, 0.92) * blink * 1.2;
    } else if material == 7.0 {
        base = vec3<f32>(0.77, 0.68, 0.48);
        emission = vec3<f32>(1.0, 0.72, 0.38) * 1.1;
    } else if material == 8.0 {
        base = vec3<f32>(0.23, 0.27, 0.30);
    } else if material == 9.0 {
        base = vec3<f32>(0.55, 0.78, 1.0);
        emission = vec3<f32>(0.45, 0.8, 1.0) * (2.0 + arcPower * 5.0);
    }
    let viewRim = pow(1.0 - max(dot(normal, -direction), 0.0), 3.0) * 0.08;
    return base * (vec3<f32>(0.16) + warm + electric) + emission + vec3<f32>(viewRim);
}

fn backgroundColor(direction: vec3<f32>) -> vec3<f32> {
    let vertical = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
    return mix(vec3<f32>(0.035, 0.047, 0.060), vec3<f32>(0.16, 0.19, 0.22), vertical);
}

@vertex
fn utilityVertexMain(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    var position = vec2<f32>(-1.0, -1.0);
    if vertexIndex == 1u {
        position = vec2<f32>(3.0, -1.0);
    } else if vertexIndex == 2u {
        position = vec2<f32>(-1.0, 3.0);
    }
    return vec4<f32>(position, 0.0, 1.0);
}

@fragment
fn utilityFragmentMain(@builtin(position) fragmentPosition: vec4<f32>) -> @location(0) vec4<f32> {
    let screen = vec2<f32>(
        fragmentPosition.x / camera.viewport.x * 2.0 - 1.0,
        1.0 - fragmentPosition.y / camera.viewport.y * 2.0);
    let halfHeight = tan(0.3926991);
    let direction = normalize(camera.forward.xyz +
        camera.right.xyz * screen.x * camera.viewport.z * halfHeight +
        camera.up.xyz * screen.y * halfHeight);
    let hit = marchScene(camera.eye.xyz, direction);
    if !hit.hit {
        return vec4<f32>(backgroundColor(direction), 1.0);
    }
    return vec4<f32>(surfaceColor(hit.position, direction, hit.material), 1.0);
}
