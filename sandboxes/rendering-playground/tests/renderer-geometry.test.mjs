import assert from "node:assert/strict";
import test from "node:test";
import { createSceneVertices, setProceduralPattern } from "../wwwroot/js/webgpu-renderer.js";

test("wall vertices and normals rotate with the scene box", () => {
    const vertices = createSceneVertices({
        boxes: [{
            center: [1, 1, 2],
            size: [2, 2, 0.2],
            rotationDegrees: 90,
            color: [0.5, 0.6, 0.7],
        }],
    });

    assert.equal(vertices.length, 36 * 13);
    assert.ok(Math.abs(vertices[0] - 1.1) < 1e-6);
    assert.ok(Math.abs(vertices[1]) < 1e-6);
    assert.ok(Math.abs(vertices[2] - 3) < 1e-6);
    assert.ok(Math.abs(vertices[3] - 1) < 1e-6);
    assert.ok(Math.abs(vertices[5]) < 1e-6);
    assert.equal(vertices[12], 0);
});

test("only wall and preview geometry receives procedural pattern coordinates", () => {
    const vertices = createSceneVertices({
        boxes: [
            { id: "wall-1", center: [0, 1.2, 0], size: [2, 2.4, 0.14], color: [0.5, 0.6, 0.7] },
            { id: "ground", center: [0, 0, 0], size: [10, 0.1, 10], color: [0.3, 0.3, 0.3] },
        ],
    });

    const wallVertexOffset = 10;
    const groundVertexOffset = 36 * 13 + 10;
    assert.deepEqual(Array.from(vertices.slice(wallVertexOffset, wallVertexOffset + 3)), [-1, 0, 1]);
    assert.equal(vertices[groundVertexOffset + 2], 0);
});

test("wall pattern coordinates are centered horizontally and measured up from the base", () => {
    const vertices = createSceneVertices({
        boxes: [{ id: "wall-1", center: [3, 1.2, -2], size: [2, 2.4, 0.14], rotationDegrees: 35, color: [0.5, 0.6, 0.7] }],
    });
    const faceCoordinates = (faceIndex) => Array.from({ length: 6 }, (_, vertex) => {
        const offset = (faceIndex * 6 + vertex) * 13 + 10;
        return [vertices[offset], vertices[offset + 1]];
    });

    for (const [u, v] of faceCoordinates(0)) {
        assert.ok(Math.abs(u) === 1 && (v === 0 || Math.abs(v - 2.4) < 1e-6));
    }
    assert.ok(faceCoordinates(2).every(([u]) => u === 1), "end face lies on the wall's horizontal boundary");
    assert.ok(faceCoordinates(4).every(([, v]) => Math.abs(v - 2.4) < 1e-6), "top face lies on the wall's upper boundary");
});

test("procedural pattern setting rejects non-boolean values", () => {
    assert.throws(() => setProceduralPattern("enabled"), RangeError);
    assert.throws(() => setProceduralPattern(1), RangeError);
});
