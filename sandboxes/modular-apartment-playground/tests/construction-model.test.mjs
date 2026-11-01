import assert from "node:assert/strict";
import test from "node:test";
import {
    ConstructionModel,
    findOverlaps,
    pickWall,
    wallEndpoints,
    wallsOverlap,
} from "../wwwroot/js/construction-model.js";

test("snapped walls form a rectangle with exactly shared endpoints", () => {
    const model = new ConstructionModel();
    const north = model.addWall(0.1, -0.9, 0);
    const east = model.addWall(1.1, 0.1, 90);
    const south = model.addWall(-0.1, 1.1, 180);
    const west = model.addWall(-0.9, -0.1, 270);

    assert.deepEqual(wallEndpoints(north), [[-1, -1], [1, -1]]);
    assert.deepEqual(wallEndpoints(east), [[1, 1], [1, -1]]);
    assert.deepEqual(wallEndpoints(south), [[1, 1], [-1, 1]]);
    assert.deepEqual(wallEndpoints(west), [[-1, -1], [-1, 1]]);
    assert.deepEqual(findOverlaps(model.walls), []);
});

test("moving and rotating one wall does not change another wall", () => {
    const model = new ConstructionModel();
    const first = model.addWall(0, 0);
    const second = model.addWall(3, 0);

    model.moveWall(first.id, 0.75, 1.2);
    model.rotateWall(first.id, 92);

    assert.deepEqual(model.walls.find((wall) => wall.id === second.id), second);
    assert.deepEqual(model.walls.find((wall) => wall.id === first.id), {
        ...first, x: 1, z: 1, rotationDegrees: 90,
    });
});

test("snapping can be disabled and re-enabled without changing existing walls", () => {
    const model = new ConstructionModel();
    model.setSnapEnabled(false);
    const free = model.addWall(0.23, -0.36, 17.5);
    model.setSnapEnabled(true);
    const snapped = model.addWall(0.23, -0.36, 17.5);

    assert.deepEqual([free.x, free.z, free.rotationDegrees], [0.23, -0.36, 17.5]);
    assert.deepEqual([snapped.x, snapped.z, snapped.rotationDegrees], [0, -0.5, 0]);
    assert.deepEqual(model.walls[0], free);
});

test("free rotation preserves positive precision and normalizes wrapped angles", () => {
    const model = new ConstructionModel();
    model.setSnapEnabled(false);

    assert.equal(model.rotationAt(12.3456), 12.3456);
    assert.equal(model.rotationAt(0.0000001234), 0.0000001234);
    assert.equal(model.rotationAt(370.125), 10.125);
    assert.equal(model.rotationAt(-45), 315);
    assert.equal(model.rotationAt(-Number.EPSILON), 0);
    assert.equal(Object.is(model.rotationAt(-0), 0), true);
});

test("grid and rotation increments are configurable", () => {
    const model = new ConstructionModel();
    model.setGridSpacing(0.25);
    model.setRotationStep(15);
    const wall = model.addWall(0.37, 0.13, 23);

    assert.deepEqual([wall.x, wall.z, wall.rotationDegrees], [0.25, 0.25, 30]);
});

test("undo and redo restore additions, transformations, and deletions", () => {
    const model = new ConstructionModel();
    const first = model.addWall(0, 0);
    const second = model.addWall(3, 0, 90);
    model.moveWall(first.id, 1, 1);
    model.rotateWall(first.id, 90);
    model.deleteWall(second.id);

    assert.equal(model.undo(), true);
    assert.deepEqual(model.walls.find((wall) => wall.id === second.id), second);
    assert.equal(model.undo(), true);
    assert.equal(model.walls.find((wall) => wall.id === first.id).rotationDegrees, 0);
    assert.equal(model.undo(), true);
    assert.deepEqual(model.walls.find((wall) => wall.id === first.id), first);
    assert.equal(model.undo(), true);
    assert.equal(model.walls.length, 1);
    assert.equal(model.redo(), true);
    assert.equal(model.redo(), true);
    assert.equal(model.redo(), true);
    assert.equal(model.redo(), true);
    assert.equal(model.walls.length, 1);
    assert.deepEqual(model.walls[0], { ...first, x: 1, z: 1, rotationDegrees: 90 });
});

test("new edits discard redo history without reusing wall IDs", () => {
    const model = new ConstructionModel();
    model.addWall(0, 0);
    const removed = model.addWall(3, 0);
    model.undo();
    const replacement = model.addWall(4, 0);

    assert.notEqual(replacement.id, removed.id);
    assert.equal(model.canRedo, false);
    assert.equal(model.redo(), false);
});

test("crossing and physically overlapping walls are allowed but detectable", () => {
    const model = new ConstructionModel();
    model.setSnapEnabled(false);
    const first = model.addWall(0, 0);
    const crossing = model.addWall(0, 0, 90);
    const parallel = model.addWall(0, 0.1);

    assert.equal(wallsOverlap(first, crossing), true);
    assert.equal(wallsOverlap(first, parallel), true);
    assert.ok(findOverlaps(model.walls).some(([a, b]) => a === first.id && b === crossing.id));
});

test("ordinary end joins do not warn but coincident walls do", () => {
    const model = new ConstructionModel();
    const first = model.addWall(0, 0);
    const corner = model.addWall(1, -1, 90);
    const continuation = model.addWall(2, 0);
    const coincident = model.addWall(0, 0, 180);

    assert.equal(wallsOverlap(first, corner), false);
    assert.equal(wallsOverlap(first, continuation), false);
    assert.equal(wallsOverlap(first, coincident), true);
});

test("picking selects the nearest wall, including rotated walls", () => {
    const model = new ConstructionModel();
    const first = model.addWall(0, 0);
    const rotated = model.addWall(3, 0, 90);
    const behind = model.addWall(0, -3);

    assert.equal(pickWall(model.walls, { origin: [0, 1, 5], direction: [0, 0, -1] }), first.id);
    assert.equal(pickWall(model.walls, { origin: [3, 1, 5], direction: [0, 0, -1] }), rotated.id);
    assert.equal(pickWall(model.walls, { origin: [0, 3, 5], direction: [0, 0, -1] }), null);
    assert.notEqual(pickWall(model.walls, { origin: [0, 1, 5], direction: [0, 0, -1] }), behind.id);
});

test("invalid settings and positions fail explicitly without editing history", () => {
    const model = new ConstructionModel();
    assert.throws(() => model.setGridSpacing(0), RangeError);
    assert.throws(() => model.setRotationStep(Number.NaN), RangeError);
    assert.throws(() => model.addWall(Infinity, 0), RangeError);
    assert.throws(() => model.select("missing"), RangeError);
    assert.equal(model.walls.length, 0);
    assert.equal(model.canUndo, false);
});
