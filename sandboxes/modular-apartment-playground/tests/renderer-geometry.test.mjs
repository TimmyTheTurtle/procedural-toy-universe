import assert from "node:assert/strict";
import test from "node:test";
import { createSceneVertices } from "../wwwroot/js/webgpu-renderer.js";

test("wall vertices and normals rotate with the scene box", () => {
    const vertices = createSceneVertices({
        boxes: [{
            center: [1, 1, 2],
            size: [2, 2, 0.2],
            rotationDegrees: 90,
            color: [0.5, 0.6, 0.7],
        }],
    });

    assert.equal(vertices.length, 36 * 10);
    assert.ok(Math.abs(vertices[0] - 1.1) < 1e-6);
    assert.ok(Math.abs(vertices[1]) < 1e-6);
    assert.ok(Math.abs(vertices[2] - 3) < 1e-6);
    assert.ok(Math.abs(vertices[3] - 1) < 1e-6);
    assert.ok(Math.abs(vertices[5]) < 1e-6);
});
