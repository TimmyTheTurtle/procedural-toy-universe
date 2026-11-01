import assert from "node:assert/strict";
import test from "node:test";
import {
    createScene,
    createGridBoxes,
    getCameraFrame,
    getGroundOrbitPivot,
    getPointerRay,
    intersectConstructionPlane,
    orbitCameraAroundGroundPoint,
    panCameraOnConstructionPlane,
} from "../wwwroot/js/scene-model.js";

test("scene boxes have unique IDs and valid dimensions", () => {
    const scene = createScene();
    const ids = scene.boxes.map((box) => box.id);

    assert.equal(new Set(ids).size, ids.length);
    for (const box of scene.boxes) {
        assert.ok(box.size.every((dimension) => Number.isFinite(dimension) && dimension > 0));
        assert.ok(box.center.every(Number.isFinite));
        assert.ok(box.color.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1));
    }
});

test("grid geometry stays within its reference-ground footprint", () => {
    const scene = createScene();
    const floor = scene.boxes.find((box) => box.id === "ground");
    const halfWidth = floor.size[0] / 2;
    const halfDepth = floor.size[2] / 2;

    for (const box of scene.boxes) {
        assert.ok(Math.abs(box.center[0]) + box.size[0] / 2 <= halfWidth);
        assert.ok(Math.abs(box.center[2]) + box.size[2] / 2 <= halfDepth);
    }
});

test("reference ground uses Y as vertical with the plane at Y=0", () => {
    const scene = createScene();
    const floor = scene.boxes.find((box) => box.id === "ground");

    assert.equal(floor.center[1] + floor.size[1] / 2, 0);
    assert.ok(scene.boxes.filter((box) => box.id !== "ground").every((line) => line.center[1] > 0));
});

test("grid can be hidden or recentered without changing its world spacing", () => {
    const { camera } = createScene();
    camera.target[0] = 15.3;
    camera.target[2] = -8.2;
    const visible = createGridBoxes(0.5, true, camera);
    const hidden = createGridBoxes(0.5, false, camera);

    assert.equal(hidden.length, 1);
    assert.deepEqual(hidden[0].center, [15, -0.05, -8.5]);
    assert.ok(visible.filter((box) => box.id.startsWith("grid-z-"))
        .every((box) => Number.isInteger(box.center[0] / 0.5)));
});

test("pointer rays intersect the construction plane or report a miss", () => {
    const { camera } = createScene();
    const bounds = { left: 0, top: 0, width: 800, height: 600 };
    const hit = intersectConstructionPlane(getPointerRay(camera, bounds, 400, 300));

    assert.ok(hit);
    assert.equal(hit[1], 0);
    assert.equal(intersectConstructionPlane({ origin: [0, 1, 0], direction: [1, 0, 0] }), undefined);
    assert.equal(intersectConstructionPlane({ origin: [0, 1, 0], direction: [0, 1, 0] }), undefined);
});

test("camera defaults stay within the zoom range", () => {
    const { camera } = createScene();

    assert.ok(camera.distance >= camera.minDistance);
    assert.ok(camera.distance <= camera.maxDistance);
    assert.ok(camera.pitch > -Math.PI / 2 && camera.pitch < Math.PI / 2);
});

test("construction-plane panning changes X and Z without changing Y", () => {
    const { camera } = createScene();
    const startingTarget = [...camera.target];

    panCameraOnConstructionPlane(camera, 0, 10, 0.1);

    assert.notEqual(camera.target[0], startingTarget[0]);
    assert.equal(camera.target[1], startingTarget[1]);
    assert.notEqual(camera.target[2], startingTarget[2]);
});

test("ground orbit pivot is the construction-plane point under the cursor", () => {
    const { camera } = createScene();
    const bounds = { left: 100, top: 50, width: 800, height: 600 };
    const pivot = getGroundOrbitPivot(camera, bounds, 600, 250);

    assert.ok(pivot);
    assert.equal(pivot.point[1], 0);
    assert.equal(pivot.screenX, 0.25);
    assert.ok(Math.abs(pivot.screenY - 1 / 3) < 1e-12);
    assert.ok(pivot.depth > 0);
});

test("orbiting preserves the ground pivot under the original cursor position", () => {
    const { camera } = createScene();
    const bounds = { left: 100, top: 50, width: 800, height: 600 };
    const aspect = bounds.width / bounds.height;
    const pivot = getGroundOrbitPivot(camera, bounds, 600, 250);

    camera.yaw += 0.2;
    camera.pitch -= 0.1;
    orbitCameraAroundGroundPoint(camera, pivot, aspect);

    const frame = getCameraFrame(camera);
    const relative = pivot.point.map((value, index) => value - frame.eye[index]);
    const depth = relative.reduce((sum, value, index) => sum + value * frame.forward[index], 0);
    const focalLength = 1 / Math.tan(Math.PI / 8);
    const screenX = relative.reduce((sum, value, index) => sum + value * frame.right[index], 0) /
        (depth * aspect / focalLength);
    const screenY = relative.reduce((sum, value, index) => sum + value * frame.up[index], 0) /
        (depth / focalLength);

    assert.ok(Math.abs(screenX - pivot.screenX) < 1e-10);
    assert.ok(Math.abs(screenY - pivot.screenY) < 1e-10);
    assert.equal(pivot.point[1], 0);
});
