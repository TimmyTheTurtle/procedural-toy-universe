export function createCamera() {
    return {
        target: [0, 1, 0],
        yaw: 0.72,
        pitch: 0.38,
        distance: 11,
        minDistance: 4.5,
        maxDistance: 24,
    };
}

export function createGridBoxes(spacing, visible, camera) {
    if (!Number.isFinite(spacing) || spacing <= 0) {
        throw new RangeError("Grid spacing must be a positive finite number.");
    }

    const halfCells = Math.ceil(12 / spacing);
    const halfWidth = halfCells * spacing;
    const centerX = Math.floor(camera.target[0] / spacing) * spacing;
    const centerZ = Math.floor(camera.target[2] / spacing) * spacing;
    const width = halfWidth * 2;
    const boxes = [{
        id: "ground",
        center: [centerX, -0.05, centerZ],
        size: [width + 0.02, 0.1, width + 0.02],
        color: [0.32, 0.36, 0.4],
    }];

    if (!visible) {
        return boxes;
    }

    for (let step = -halfCells; step <= halfCells; step += 1) {
        const x = centerX + step * spacing;
        const z = centerZ + step * spacing;
        boxes.push({
            id: `grid-x-${step}`,
            center: [centerX, 0.008, z],
            size: [width, 0.008, 0.012],
            color: Math.abs(z) < 1e-8 ? [0.33, 0.52, 0.65] : [0.53, 0.58, 0.63],
        });
        boxes.push({
            id: `grid-z-${step}`,
            center: [x, 0.008, centerZ],
            size: [0.012, 0.008, width],
            color: Math.abs(x) < 1e-8 ? [0.56, 0.42, 0.32] : [0.53, 0.58, 0.63],
        });
    }

    return boxes;
}

export function createScene() {
    const camera = createCamera();
    return { camera, boxes: createGridBoxes(0.5, true, camera) };
}

export function panCameraOnConstructionPlane(camera, deltaX, deltaY, scale) {
    const cosine = Math.cos(camera.yaw);
    const sine = Math.sin(camera.yaw);

    camera.target[0] += -deltaX * scale * cosine - deltaY * scale * sine;
    camera.target[2] += deltaX * scale * sine - deltaY * scale * cosine;
}

export function getCameraFrame(camera) {
    const cosinePitch = Math.cos(camera.pitch);
    const sinePitch = Math.sin(camera.pitch);
    const sineYaw = Math.sin(camera.yaw);
    const cosineYaw = Math.cos(camera.yaw);
    const forward = [
        -cosinePitch * sineYaw,
        -sinePitch,
        -cosinePitch * cosineYaw,
    ];

    return {
        eye: camera.target.map((value, index) => value - forward[index] * camera.distance),
        forward,
        right: [cosineYaw, 0, -sineYaw],
        up: [
            -sinePitch * sineYaw,
            cosinePitch,
            -sinePitch * cosineYaw,
        ],
    };
}

export function getPointerRay(camera, bounds, pointerX, pointerY) {
    if (bounds.width <= 0 || bounds.height <= 0) {
        return undefined;
    }

    const screenX = (pointerX - bounds.left) / bounds.width * 2 - 1;
    const screenY = 1 - (pointerY - bounds.top) / bounds.height * 2;
    const aspect = bounds.width / bounds.height;
    const focalLength = 1 / Math.tan(Math.PI / 8);
    const frame = getCameraFrame(camera);
    const ray = [
        frame.forward[0] + frame.right[0] * screenX * aspect / focalLength + frame.up[0] * screenY / focalLength,
        frame.forward[1] + frame.right[1] * screenX * aspect / focalLength + frame.up[1] * screenY / focalLength,
        frame.forward[2] + frame.right[2] * screenX * aspect / focalLength + frame.up[2] * screenY / focalLength,
    ];
    const rayLength = Math.hypot(...ray);
    const direction = ray.map((value) => value / rayLength);

    return { origin: frame.eye, direction, screenX, screenY };
}

export function intersectConstructionPlane(ray) {
    if (!ray || Math.abs(ray.direction[1]) < 1e-10) {
        return undefined;
    }

    const distance = -ray.origin[1] / ray.direction[1];
    if (distance <= 0) {
        return undefined;
    }

    return [
        ray.origin[0] + ray.direction[0] * distance,
        0,
        ray.origin[2] + ray.direction[2] * distance,
    ];
}

export function getGroundOrbitPivot(camera, bounds, pointerX, pointerY) {
    const ray = getPointerRay(camera, bounds, pointerX, pointerY);
    if (!ray || ray.direction[1] >= -Number.EPSILON) {
        return undefined;
    }
    const point = intersectConstructionPlane(ray);
    if (!point) {
        return undefined;
    }

    const frame = getCameraFrame(camera);
    point[1] = 0;
    const depth = point.reduce(
        (sum, value, index) => sum + (value - ray.origin[index]) * frame.forward[index],
        0,
    );

    return { point, screenX: ray.screenX, screenY: ray.screenY, depth };
}

export function orbitCameraAroundGroundPoint(camera, pivot, aspect) {
    const frame = getCameraFrame(camera);
    const focalLength = 1 / Math.tan(Math.PI / 8);
    const cameraX = pivot.screenX * aspect * pivot.depth / focalLength;
    const cameraY = pivot.screenY * pivot.depth / focalLength;

    for (let axis = 0; axis < 3; axis += 1) {
        camera.target[axis] =
            pivot.point[axis] -
            frame.right[axis] * cameraX -
            frame.up[axis] * cameraY +
            frame.forward[axis] * (camera.distance - pivot.depth);
    }
}
