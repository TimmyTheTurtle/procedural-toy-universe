import assert from "node:assert/strict";
import test from "node:test";
import { createReferenceBoxes, createReferenceVertices, greebleGrid } from "../wwwroot/js/reference-scene.js";

const features = {
    cutouts: true, frame: true, slats: true, flushHatch: true,
    recessedHatch: true, controlPanel: true, overheadFixture: true,
};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

function boxFront(boxes, x, y) {
    const hits = boxes.filter((part) => x > part.min[0] && x < part.max[0] && y > part.min[1] && y < part.max[1]);
    return hits.length ? Math.max(...hits.map((part) => part.max[2])) : undefined;
}

function meshFront(vertices, x, y) {
    let depth;
    for (let offset = 0; offset < vertices.length; offset += 24) {
        if (vertices[offset + 5] !== 1) continue;
        const a = vertices.subarray(offset, offset + 3);
        const b = vertices.subarray(offset + 8, offset + 11);
        const c = vertices.subarray(offset + 16, offset + 19);
        const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        if (Math.abs(denominator) < 1e-12) continue;
        const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator;
        const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator;
        if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) depth = Math.max(depth ?? -Infinity, a[2]);
    }
    return depth;
}

test("reference mesh reproduces hatch recesses, through-openings, and controls", () => {
    const boxes = createReferenceBoxes(features);
    const vertices = createReferenceVertices(features);
    for (const [x, y, expected] of [
        [-1.3, 0.72, 0.07], [1.3, 0.72, 0.035], [-1.83, 0.72, 0.005],
        [1.83, 0.72, 0.005], [2.07, 0.845, 0.12], [1.3, 1.6, 0.14],
    ]) {
        close(boxFront(boxes, x, y), expected);
        close(meshFront(vertices, x, y), expected);
    }
    assert.equal(boxFront(boxes, -1.3, 1.65), undefined);
    assert.equal(meshFront(vertices, -1.3, 1.65), undefined);
    const noHatches = createReferenceBoxes({ ...features, flushHatch: false, recessedHatch: false });
    close(boxFront(noHatches, 1.3, 0.72), 0.07);
    const solid = createReferenceBoxes({ ...features, cutouts: false, slats: false });
    close(boxFront(solid, -1.3, 1.65), 0.07);
    assert.equal(createReferenceBoxes({ ...features, overheadFixture: false }).some((part) => part.fixture), false);
});

test("all detail and moving fixture vertices stay within the fixed module envelopes", () => {
    for (const count of [0, 8, 32, 128]) {
        const vertices = createReferenceVertices({ ...features, hatchClutter: true }, count);
        assert.equal(vertices.length % 24, 0);
        for (let offset = 0; offset < vertices.length; offset += 8) {
            const center = vertices[offset] < 0 ? -1.3 : 1.3;
            for (const motion of [-0.32, 0.32]) {
                const x = vertices[offset] + (vertices[offset + 7] ? motion : 0) - center;
                assert.ok(x >= -1.000001 && x <= 1.000001);
                assert.ok(vertices[offset + 1] >= 0 && vertices[offset + 1] <= 2.400001);
                assert.ok(vertices[offset + 2] >= -0.070001 && vertices[offset + 2] <= 0.270001);
            }
            close(Math.hypot(...vertices.subarray(offset + 3, offset + 6)), 1);
            assert.ok([0, 1, 2, 3, 4, 5, 6].includes(vertices[offset + 6]));
        }
    }
});

test("optional stationary pipes match mesh depths and block overhead rays before the source", () => {
    const enabled = { ...features, hatchClutter: true };
    const boxes = createReferenceBoxes(enabled);
    const vertices = createReferenceVertices(enabled);
    assert.equal(boxes.filter((part) => part.material === 6).length, 5);
    assert.ok(boxes.filter((part) => part.material === 6).every((part) => !part.fixture));
    assert.equal(createReferenceBoxes(features).some((part) => part.material === 6), false);
    for (const [x, y, z] of [[1.3, 1.10, 0.225], [0.96, 0.92, 0.235], [1.6, 1.10, 0.24]]) {
        close(boxFront(boxes, x, y), z);
        close(meshFront(vertices, x, y), z);
    }
    const start = [1.3, 0.72, 0.039];
    const light = [1.3, 1.225, 0.18];
    const blocked = (parts) => parts.some((part) => {
        if (part.fixture) return false;
        let entry = 0;
        let exit = 1;
        for (let axis = 0; axis < 3; axis += 1) {
            const delta = light[axis] - start[axis];
            if (delta === 0) {
                if (start[axis] < part.min[axis] || start[axis] > part.max[axis]) return false;
                continue;
            }
            const distances = [(part.min[axis] - start[axis]) / delta, (part.max[axis] - start[axis]) / delta];
            entry = Math.max(entry, Math.min(...distances));
            exit = Math.min(exit, Math.max(...distances));
        }
        return entry < exit && entry < 1 && exit > 0;
    });
    assert.equal(blocked(createReferenceBoxes(features)), false);
    assert.equal(blocked(boxes), true);
    assert.ok(createReferenceBoxes({ ...enabled, overheadFixture: false }).some((part) => part.material === 6));
});

test("deterministic greeble grid grows geometry and mesh silhouettes match box unions", () => {
    let previous = 0;
    for (const count of [0, 8, 32, 128]) {
        const grid = greebleGrid(count);
        assert.equal(grid.columns * grid.rows, count);
        const boxes = createReferenceBoxes(features, count);
        const vertices = createReferenceVertices(features, count);
        assert.ok(vertices.length > previous);
        previous = vertices.length;
        assert.deepEqual(vertices, createReferenceVertices(features, count));
        for (let index = 0; index < 100; index += 1) {
            const x = -2.29 + index * 4.58 / 99;
            const y = 0.03 + (index * 37 % 100) * 2.34 / 100;
            const expected = boxFront(boxes, x, y);
            const actual = meshFront(vertices, x, y);
            if (expected === undefined) assert.equal(actual, undefined);
            else close(actual, expected);
        }
    }
    assert.throws(() => greebleGrid(64), RangeError);
});
