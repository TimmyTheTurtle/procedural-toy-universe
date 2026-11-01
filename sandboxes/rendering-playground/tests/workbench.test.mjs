import assert from "node:assert/strict";
import test from "node:test";
import { getCameraFrame } from "../wwwroot/js/scene-model.js";
import { WorkbenchController } from "../wwwroot/js/workbench.js";

globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
};

class FakeCanvas {
    handlers = new Map();
    captured = new Set();

    addEventListener(name, handler) { this.handlers.set(name, handler); }
    removeEventListener(name) { this.handlers.delete(name); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
    focus() {}
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); }
}

class FakeRenderer {
    async start(canvas, scene, onStatus) {
        this.scene = scene;
        this.onStatus = onStatus;
        return { ready: true, message: "Ready" };
    }

    updateScene(scene) { this.scene = scene; }
    render() {}
    setProceduralPattern(enabled) { this.patternEnabled = enabled; }
    setLightSize(size) { this.lightSize = size; }
    setLightAnimation(enabled) { this.lightAnimation = enabled; }
    setLightAnimationSpeed(speed) { this.lightAnimationSpeed = speed; }
    async setRenderMode(mode, onStatus) {
        this.renderMode = mode;
        onStatus?.(`${mode} renderer active.`);
        return `${mode} shader source`;
    }
    setShaderFeature(name, enabled) {
        this.shaderFeatures ??= {};
        this.shaderFeatures[name] = enabled;
    }
    updateShader(source, onStatus) {
        this.shaderSource = source;
        onStatus?.("Shader compiled and applied.");
    }
    stop() {}
}

test("matching triangle reference mode preserves editable construction and reference camera", async (t) => {
    const { controller, renderer } = await setup(t);
    controller.model.addWall(2, 3, 45);
    const walls = JSON.stringify(controller.model.walls);
    const camera = JSON.stringify(controller.camera);
    await controller.setRenderMode("reference");
    controller.click(400, 300);
    assert.equal(renderer.renderMode, "reference");
    assert.equal(JSON.stringify(controller.model.walls), walls);
    assert.equal(JSON.stringify(controller.camera), camera);
    assert.equal(controller.preview, null);
    await controller.setRenderMode("triangles");
    assert.equal(JSON.stringify(controller.model.walls), walls);
});

async function setup(t) {
    const canvas = new FakeCanvas();
    const renderer = new FakeRenderer();
    const states = [];
    const controller = new WorkbenchController(canvas, (state) => states.push(state), () => {}, renderer);
    await controller.start();
    t.after(() => controller.dispose());
    return { canvas, controller, renderer, states };
}

function projectGroundPoint(camera, x, z) {
    const frame = getCameraFrame(camera);
    const relative = [x - frame.eye[0], -frame.eye[1], z - frame.eye[2]];
    const dot = (axis) => relative.reduce((sum, value, index) => sum + value * axis[index], 0);
    const depth = dot(frame.forward);
    const scale = 1 / Math.tan(Math.PI / 8);
    const screenX = dot(frame.right) * scale / (depth * 800 / 600);
    const screenY = dot(frame.up) * scale / depth;
    return { x: (screenX + 1) * 400, y: (1 - screenY) * 300 };
}

function pointer(x, y, button = 0) {
    return { clientX: x, clientY: y, button, pointerId: 1, detail: 1, shiftKey: false };
}

test("placing, duplicating, moving and history affect independently editable walls", async (t) => {
    const { controller, renderer } = await setup(t);
    controller.beginPlacement();
    const origin = projectGroundPoint(controller.camera, 0, 0);
    controller.click(origin.x, origin.y);
    const first = controller.model.selectedWall;

    controller.beginDuplicate();
    const duplicatePoint = projectGroundPoint(controller.camera, 3, 0);
    controller.click(duplicatePoint.x, duplicatePoint.y);
    const second = controller.model.selectedWall;
    assert.notEqual(first.id, second.id);
    assert.equal(second.x, 3);

    controller.beginMove();
    const movedPoint = projectGroundPoint(controller.camera, 4, 1);
    controller.click(movedPoint.x, movedPoint.y);
    assert.deepEqual(controller.model.walls[0], first);
    assert.deepEqual([controller.model.selectedWall.x, controller.model.selectedWall.z], [4, 1]);
    assert.equal(renderer.scene.boxes.filter((box) => box.id.startsWith("wall-")).length, 2);

    controller.undo();
    assert.equal(controller.model.selectedWall.x, 3);
    controller.redo();
    assert.equal(controller.model.selectedWall.x, 4);
});

test("overlap warning is shown without blocking placement", async (t) => {
    const { controller } = await setup(t);
    const point = projectGroundPoint(controller.camera, 0, 0);
    controller.beginPlacement();
    controller.click(point.x, point.y);
    controller.beginPlacement();
    controller.lastPointer = point;
    controller.updatePreview();
    assert.match(controller.warning(), /Preview overlaps wall-1/);
    controller.click(point.x, point.y);

    assert.equal(controller.model.walls.length, 2);
    assert.match(controller.snapshot().warning, /wall-1 overlaps wall-2/);
});

test("procedural pattern setting reaches the renderer without changing construction state", async (t) => {
    const { controller, renderer } = await setup(t);
    controller.setProceduralPattern(true);

    assert.equal(renderer.patternEnabled, true);
    assert.match(controller.snapshot().feedback, /vent grill enabled/);
    assert.equal(controller.model.walls.length, 0);
});

test("invalid procedural pattern setting is reported without reaching the renderer", async (t) => {
    const { controller, renderer } = await setup(t);
    controller.setProceduralPattern("true");

    assert.equal(renderer.patternEnabled, undefined);
    assert.match(controller.snapshot().feedback, /must be a boolean/);
});

test("shader-step settings reach the renderer without changing construction state", async (t) => {
    const { controller, renderer } = await setup(t);
    controller.setShaderFeature("lighting", false);

    assert.equal(renderer.shaderFeatures.lighting, false);
    for (const name of ["flushHatch", "recessedHatch", "controlPanel", "overheadFixture", "hatchClutter", "lightEmission", "localLight", "directionalLight", "overheadLight", "overheadShadows", "lightFlicker"]) {
        controller.setShaderFeature(name, false);
        assert.equal(renderer.shaderFeatures[name], false);
        controller.setShaderFeature(name, true);
        assert.equal(renderer.shaderFeatures[name], true);
    }
    assert.equal(controller.model.walls.length, 0);
});

test("light size inputs reach the renderer without changing construction state", async (t) => {
    const { controller, renderer } = await setup(t);
    const walls = controller.model.walls;
    controller.setLightSize("0.5");
    assert.equal(renderer.lightSize, 0.5);
    assert.deepEqual(controller.model.walls, walls);
    for (const input of ["", "invalid", NaN, Infinity]) {
        assert.throws(() => controller.setLightSize(input), RangeError);
    }
    assert.equal(renderer.lightSize, 0.5);
});

test("shader source edits are sent to the renderer and report their status", async (t) => {
    const { controller, renderer } = await setup(t);
    const statuses = [];
    controller.onShader = (status) => statuses.push(status);
    controller.setShaderSource("custom WGSL");

    assert.equal(renderer.shaderSource, "custom WGSL");
    assert.deepEqual(statuses, ["Shader compiled and applied."]);
});

test("lamp animation controls reach the renderer without editing construction", async (t) => {
    const { controller, renderer } = await setup(t);
    controller.setLightAnimation(true);
    controller.setLightAnimationSpeed("0.5");
    assert.equal(renderer.lightAnimation, true);
    assert.equal(renderer.lightAnimationSpeed, 0.5);
    controller.setLightAnimation(false);
    assert.equal(renderer.lightAnimation, false);
    for (const value of ["", "invalid", NaN, Infinity]) {
        assert.throws(() => controller.setLightAnimationSpeed(value), RangeError);
    }
    assert.equal(controller.model.walls.length, 0);
});
test("renderer mode switches preserve construction data and report the active shader", async (t) => {
    const { controller, renderer } = await setup(t);
    const statuses = [];
    controller.onShader = (status) => statuses.push(status);
    controller.beginPlacement();
    controller.preview = { x: 1, z: 2 };
    const source = await controller.setRenderMode("raymarch");

    assert.equal(source, "raymarch shader source");
    assert.equal(renderer.renderMode, "raymarch");
    assert.equal(controller.renderMode, "raymarch");
    assert.equal(controller.mode, "select");
    assert.equal(controller.preview, null);
    assert.equal(controller.model.walls.length, 0);
    assert.deepEqual(statuses, ["raymarch renderer active."]);
    assert.match(controller.snapshot().feedback, /flush left, recessed right/);
});

test("camera drags and reset do not add, remove, or select walls", async (t) => {
    const { controller } = await setup(t);
    controller.beginPlacement();
    const point = projectGroundPoint(controller.camera, 0, 0);
    controller.click(point.x, point.y);
    controller.model.select(null);
    const original = controller.model.walls;

    controller.pointerDown(pointer(400, 300));
    controller.pointerMove(pointer(440, 320));
    controller.pointerUp(pointer(440, 320));
    controller.pointerDown(pointer(400, 300, 2));
    controller.pointerMove(pointer(430, 340, 2));
    controller.pointerUp(pointer(430, 340, 2));
    controller.doubleClick({ clientX: 400, clientY: 300, preventDefault() {} });

    assert.deepEqual(controller.model.walls, original);
    assert.equal(controller.model.selectedId, null);
});

test("camera movement commits a pending click before changing the view", async (t) => {
    const { controller } = await setup(t);
    const origin = projectGroundPoint(controller.camera, 0, 0);
    controller.beginPlacement();
    controller.pointerDown(pointer(origin.x, origin.y));
    controller.pointerUp(pointer(origin.x, origin.y));
    assert.equal(controller.model.walls.length, 0);

    controller.pointerDown(pointer(400, 300, 2));
    controller.pointerMove(pointer(440, 320, 2));
    controller.pointerUp(pointer(440, 320, 2));
    assert.equal(controller.model.walls.length, 1);
    assert.deepEqual(
        [controller.model.selectedWall.x, controller.model.selectedWall.z],
        [0, 0],
    );

    controller.beginPlacement();
    const nextPoint = projectGroundPoint(controller.camera, 3, 0);
    controller.pointerDown(pointer(nextPoint.x, nextPoint.y));
    controller.pointerUp(pointer(nextPoint.x, nextPoint.y));
    controller.wheel({ deltaY: 500, preventDefault() {} });
    assert.equal(controller.model.walls.length, 2);
    assert.deepEqual(
        [controller.model.selectedWall.x, controller.model.selectedWall.z],
        [3, 0],
    );
});

test("separate clicks within the delay retain their original order and positions", async (t) => {
    const { controller } = await setup(t);
    const origin = projectGroundPoint(controller.camera, 0, 0);
    const elsewhere = projectGroundPoint(controller.camera, 4, 0);
    controller.beginPlacement();
    controller.pointerDown(pointer(origin.x, origin.y));
    controller.pointerUp(pointer(origin.x, origin.y));
    controller.pointerDown(pointer(elsewhere.x, elsewhere.y));
    controller.pointerUp(pointer(elsewhere.x, elsewhere.y));
    controller.wheel({ deltaY: 100, preventDefault() {} });

    assert.equal(controller.model.walls.length, 1);
    assert.deepEqual([controller.model.walls[0].x, controller.model.walls[0].z], [0, 0]);
    assert.equal(controller.model.selectedId, null);
});

test("double-click reset cancels its own clicks without dropping an earlier placement", async (t) => {
    const { controller } = await setup(t);
    const origin = projectGroundPoint(controller.camera, 0, 0);
    const elsewhere = projectGroundPoint(controller.camera, 4, 0);
    controller.beginPlacement();
    controller.pointerDown(pointer(origin.x, origin.y));
    controller.pointerUp(pointer(origin.x, origin.y));
    controller.pointerDown(pointer(elsewhere.x, elsewhere.y));
    controller.pointerUp(pointer(elsewhere.x, elsewhere.y));
    controller.pointerDown({ ...pointer(elsewhere.x, elsewhere.y), detail: 2 });
    controller.pointerUp({ ...pointer(elsewhere.x, elsewhere.y), detail: 2 });
    controller.doubleClick({ clientX: elsewhere.x, clientY: elsewhere.y, preventDefault() {} });

    assert.equal(controller.model.walls.length, 1);
    assert.deepEqual([controller.model.walls[0].x, controller.model.walls[0].z], [0, 0]);
    assert.equal(controller.feedback, "Camera reset.");
});

test("shift-double-click preserves an earlier placement without treating the pan clicks as edits", async (t) => {
    const { controller } = await setup(t);
    const origin = projectGroundPoint(controller.camera, 0, 0);
    const elsewhere = projectGroundPoint(controller.camera, 4, 0);
    const shifted = { ...pointer(elsewhere.x, elsewhere.y), shiftKey: true };
    controller.beginPlacement();
    controller.pointerDown(pointer(origin.x, origin.y));
    controller.pointerUp(pointer(origin.x, origin.y));
    controller.pointerDown(shifted);
    controller.pointerUp(shifted);
    controller.pointerDown(shifted);
    controller.pointerUp(shifted);
    controller.doubleClick({ clientX: elsewhere.x, clientY: elsewhere.y, preventDefault() {} });

    assert.equal(controller.model.walls.length, 1);
    assert.deepEqual([controller.model.walls[0].x, controller.model.walls[0].z], [0, 0]);
});

test("settings changes apply after a pending placement, while cancel discards it", async (t) => {
    const { controller } = await setup(t);
    const point = projectGroundPoint(controller.camera, 0.23, 0.17);
    controller.beginPlacement();
    controller.pointerDown(pointer(point.x, point.y));
    controller.pointerUp(pointer(point.x, point.y));
    controller.setSnap(false);

    assert.equal(controller.model.walls.length, 1);
    assert.deepEqual([controller.model.walls[0].x, controller.model.walls[0].z], [0, 0]);
    assert.equal(controller.model.snapEnabled, false);

    controller.beginPlacement();
    controller.pointerDown(pointer(point.x, point.y));
    controller.pointerUp(pointer(point.x, point.y));
    controller.cancel();
    assert.equal(controller.model.walls.length, 1);
    assert.equal(controller.mode, "select");
});

test("renderer retry preserves the construction model", async (t) => {
    const { controller, renderer } = await setup(t);
    controller.beginPlacement();
    const point = projectGroundPoint(controller.camera, 0, 0);
    controller.click(point.x, point.y);
    const walls = controller.model.walls;

    renderer.onStatus({ ready: false, message: "Device lost" });
    assert.equal(controller.ready, false);
    await controller.start();

    assert.equal(controller.ready, true);
    assert.deepEqual(controller.model.walls, walls);
    assert.ok(renderer.scene.boxes.some((box) => box.id === walls[0].id));
});

test("invalid settings are reported without changing the model", async (t) => {
    const { controller } = await setup(t);
    controller.setGridSpacing("");
    assert.equal(controller.model.gridSpacing, 0.5);
    assert.match(controller.snapshot().feedback, /Grid spacing must be a number/);
});
