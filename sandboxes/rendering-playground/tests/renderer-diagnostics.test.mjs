import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
    getDefaultShaderSource,
    utilityArcFlashIntensity,
    getLightSize,
    lightFlickerBrightness,
    getLightAnimation,
    getRenderMode,
    getShaderFeatures,
    getShaderSource,
    setRenderMode,
    setShaderFeature,
    setLightSize,
    setLightAnimation,
    setLightAnimationSpeed,
    getComparisonSettings,
    setRenderScale,
    setGreebleCount,
    setShadowResolution,
    runComparison,
    getOverheadIntensity,
    setOverheadIntensity,
    start,
    stop,
    updateShader,
} from "../wwwroot/js/webgpu-renderer.js";
import { createCamera } from "../wwwroot/js/scene-model.js";

const defaultShaderSource = readFileSync(
    new URL("../wwwroot/shaders/procedural-vent-grill.wgsl", import.meta.url),
    "utf8",
);
const raymarchShaderSource = readFileSync(
    new URL("../wwwroot/shaders/raymarched-vent-wall.wgsl", import.meta.url),
    "utf8",
);
const meshShaderSource = readFileSync(new URL("../wwwroot/shaders/reference-mesh.wgsl", import.meta.url), "utf8");
const maintenanceShaderSource = readFileSync(
    new URL("../wwwroot/shaders/raymarched-maintenance-bay.wgsl", import.meta.url),
    "utf8",
);

test("maintenance bay is a ray-marched SDF scene with the hidden arc behind the pipe field", () => {
    assert.match(maintenanceShaderSource, /fn capsuleDistance\(/);
    assert.match(maintenanceShaderSource, /fn sceneSurface\(/);
    assert.match(maintenanceShaderSource, /fn marchScene\(/);
    assert.match(maintenanceShaderSource, /fn shadowVisibility\(/);
    assert.match(maintenanceShaderSource, /const workLightPosition = vec3<f32>\(-0\.48, 2\.51, 0\.12\)/);
    assert.match(maintenanceShaderSource, /const arcSourcePosition = vec3<f32>\(1\.24, 1\.70, 0\.16\)/);
    assert.match(maintenanceShaderSource, /if camera\.accentSettings\.z > 0\.5 && camera\.accentSettings\.y > 0\.05/);
    assert.match(maintenanceShaderSource, /surface = nearestSurface\(surface, vec2<f32>\(arc, 9\.0\)\)/);
    assert.match(maintenanceShaderSource, /return vec4<f32>\(surfaceColor\(hit\.position, direction, hit\.material\), 1\.0\)/);
});

test("electrical arc flashes are bounded and deterministic", () => {
    assert.equal(utilityArcFlashIntensity(0.05), 1);
    assert.equal(utilityArcFlashIntensity(0.5), 0);
    assert.equal(utilityArcFlashIntensity(0.05), utilityArcFlashIntensity(0.05));
    assert.throws(() => utilityArcFlashIntensity(-0.1), RangeError);
    assert.throws(() => utilityArcFlashIntensity(Number.NaN), RangeError);
});

test("ray shader selects the analytic floor normal before optional wall estimation", () => {
    assert.match(raymarchShaderSource,
        /if hit\.ground \{\s*\/\/[^\n]*\n\s*normal = vec3<f32>\(0\.0, 1\.0, 0\.0\);\s*\} else if camera\.detailSettings\.w > 0\.5 \{\s*normal = estimateNormal\(hit\.position\);/);
    assert.match(raymarchShaderSource, /let isGround = hit\.ground;/);
    assert.doesNotMatch(raymarchShaderSource, /let isGround = hit\.position\.y/);
});

test("hatch shader preserves bounds, tagged materials, and finite local shadow rays", () => {
    assert.match(raymarchShaderSource, /surface\.x = max\(surface\.x, envelope\);/);
    assert.match(raymarchShaderSource, /const wallBoundRadius = 3\.0;/);
    assert.match(raymarchShaderSource, /const moduleOffset = 1\.3;/);
    assert.match(raymarchShaderSource, /plateCenterZ = 0\.02;\s*plateHalfDepth = 0\.015;/);
    assert.match(raymarchShaderSource, /let material = sceneSurface\(hit\.position\)\.y;/);
    assert.match(raymarchShaderSource, /if travel >= maximumTravel \{\s*break;/);
    assert.match(raymarchShaderSource, /shadowVisibility\(start, direction, lightDistance - 0\.01, false\)/);
    assert.match(raymarchShaderSource, /if camera\.detailSettings\.x > 0\.5 && camera\.up\.w > 0\.5/);
    assert.match(raymarchShaderSource, /if recessed && camera\.right\.w > 0\.5 \{\s*surface = nearestSurface\(surface, hatchClutterSurface\(point\)\);/);
    assert.match(raymarchShaderSource, /camera\.lightSettings\.z < 0\.5 \|\| camera\.accentSettings\.w <= 0\.0/);
    assert.match(raymarchShaderSource, /recessed && includeFixture && camera\.hatchSettings\.w > 0\.5/);
    assert.match(raymarchShaderSource, /let minimumStep = select\(0\.002, 0\.025, includeFixture\);/);
    assert.match(raymarchShaderSource, /camera\.hatchSettings\.w < 0\.5 \|\| camera\.accentSettings\.y < 0\.5 \|\| camera\.settings\.w < 0\.5/);
    assert.match(raymarchShaderSource, /if camera\.accentSettings\.x > 0\.5 && camera\.lightSettings\.z > 0\.5 \{\s*emission/);
    assert.match(raymarchShaderSource, /strength \* camera\.accentSettings\.w/);
    assert.match(raymarchShaderSource, /if camera\.lightSettings\.y < 0\.5 \|\| camera\.settings\.w < 0\.5/);
    assert.match(raymarchShaderSource, /clamp\(camera\.accentSettings\.z, -0\.32, 0\.32\)/);
    assert.match(raymarchShaderSource, /let local = point - lightMotionOffset\(\);/);
    assert.match(raymarchShaderSource, /overheadLightPosition \+ lightMotionOffset\(\) - start/);
});

test("main light skips faint shadow rays and keeps ambient outside its shadows", () => {
    assert.match(raymarchShaderSource, /const mainShadowContributionCutoff = 0\.05;/);
    assert.match(raymarchShaderSource, /const minimumShadowVisibility = 0\.18;/);
    assert.match(raymarchShaderSource,
        /if camera\.detailSettings\.x > 0\.5 && direct >= mainShadowContributionCutoff \{\s*direct \*= softShadow/);
    assert.match(raymarchShaderSource,
        /visibility = min\(visibility, distance \/ \(camera\.lightSettings\.x \* travel\)\);\s*if visibility <= minimumShadowVisibility \{\s*return minimumShadowVisibility;/);
    assert.match(raymarchShaderSource, /var illumination = 0\.34 \+ mainLightContribution\(hit\.position, normal\);/);
    assert.doesNotMatch(raymarchShaderSource, /illumination \*= softShadow/);
});

test("artistic flicker is deterministic, bounded, slow, and continuous", () => {
    let previous = lightFlickerBrightness(0);
    let minimum = previous;
    let maximum = previous;
    for (let index = 1; index <= 12000; index += 1) {
        const time = index * 0.01;
        const brightness = lightFlickerBrightness(time);
        assert.equal(brightness, lightFlickerBrightness(time));
        assert.ok(brightness >= 0.7 && brightness <= 1);
        assert.ok(Math.abs(brightness - previous) <= 0.003, "brightness changes slower than 0.30/s");
        previous = brightness;
        minimum = Math.min(minimum, brightness);
        maximum = Math.max(maximum, brightness);
    }
    assert.ok(maximum - minimum > 0.15, "visible artistic variation");
    for (const invalid of [-1, NaN, Infinity, "1"]) {
        assert.throws(() => lightFlickerBrightness(invalid), RangeError);
    }
});

function setBrowserGlobals(t, secure, gpu) {
    const originalSecure = Object.getOwnPropertyDescriptor(globalThis, "isSecureContext");
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");
    Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: secure });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { gpu } });
    Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        value: async (url) => {
            const path = new URL(url).pathname;
            const source = path.endsWith("raymarched-vent-wall.wgsl") ? raymarchShaderSource :
                path.endsWith("reference-mesh.wgsl") ? meshShaderSource : defaultShaderSource;
            return {
                ok: true,
                status: 200,
                text: async () => source,
            };
        },
    });
    t.after(() => {
        stop();
        if (originalSecure) {
            Object.defineProperty(globalThis, "isSecureContext", originalSecure);
        } else {
            delete globalThis.isSecureContext;
        }
        if (originalNavigator) {
            Object.defineProperty(globalThis, "navigator", originalNavigator);
        } else {
            delete globalThis.navigator;
        }
        if (originalFetch) {
            Object.defineProperty(globalThis, "fetch", originalFetch);
        } else {
            delete globalThis.fetch;
        }
    });
}

const scene = { boxes: [], camera: {} };

test("insecure contexts explain the localhost or HTTPS requirement", async (t) => {
    setBrowserGlobals(t, false, undefined);
    const result = await start({}, scene, () => {});

    assert.equal(result.ready, false);
    assert.match(result.message, /secure context.*localhost or HTTPS/i);
});

test("unsupported WebGPU and missing adapters produce distinct diagnostics", async (t) => {
    setBrowserGlobals(t, true, undefined);
    let result = await start({}, scene, () => {});
    assert.equal(result.ready, false);
    assert.match(result.message, /not available in this browser/i);

    globalThis.navigator.gpu = { requestAdapter: async () => null };
    result = await start({}, scene, () => {});
    assert.equal(result.ready, false);
    assert.match(result.message, /no compatible WebGPU adapter/i);
});

test("device initialization failures are reported and logged", async (t) => {
    const logged = [];
    const originalError = console.error;
    console.error = (...args) => logged.push(args);
    t.after(() => { console.error = originalError; });
    setBrowserGlobals(t, true, {
        requestAdapter: async () => ({
            requestDevice: async () => { throw new Error("device request rejected"); },
        }),
    });

    const result = await start({}, scene, () => {});
    assert.equal(result.ready, false);
    assert.match(result.message, /initialization failed: device request rejected/i);
    assert.equal(logged.length, 1);
});

test("a missing canvas context releases the acquired device", async (t) => {
    let destroyed = false;
    const device = {
        addEventListener() {},
        removeEventListener() {},
        destroy() { destroyed = true; },
        lost: new Promise(() => {}),
    };
    setBrowserGlobals(t, true, {
        requestAdapter: async () => ({ requestDevice: async () => device }),
    });

    const result = await start({ getContext: () => null }, scene, () => {});
    assert.equal(result.ready, false);
    assert.match(result.message, /could not create a WebGPU canvas context/i);
    assert.equal(destroyed, true);
});

test("device loss is reported, cleans up resources, and permits retry", async (t) => {
    let scheduledFrame;
    let frameRequests = 0;
    const visibilityHandlers = new Map();
    const globals = ["window", "document", "ResizeObserver", "GPUBufferUsage", "GPUTextureUsage"];
    const originals = new Map(globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    const replacements = {
        window: {
            devicePixelRatio: 1,
            requestAnimationFrame: (callback) => { frameRequests += 1; scheduledFrame = callback; return 1; },
            cancelAnimationFrame() {},
        },
        document: {
            hidden: false,
            addEventListener(name, callback) { visibilityHandlers.set(name, callback); },
            removeEventListener(name) { visibilityHandlers.delete(name); },
        },
        ResizeObserver: class { observe() {} disconnect() {} },
        GPUBufferUsage: { UNIFORM: 1, COPY_DST: 2, VERTEX: 4 },
        GPUTextureUsage: { RENDER_ATTACHMENT: 1, TEXTURE_BINDING: 2 },
    };
    for (const [name, value] of Object.entries(replacements)) {
        Object.defineProperty(globalThis, name, { configurable: true, value });
    }

    function fakeDevice() {
        let lose;
        const state = { pipelineCount: 0, pipelineEntries: [], errorScopeDepth: 0, uniforms: null };
        const device = {
            lost: new Promise((resolve) => { lose = resolve; }),
            limits: { maxTextureDimension2D: 4096 },
            queue: {
                writeBuffer(buffer, offset, data) {
                    if (buffer.uniform && data.length === 56) state.uniforms = new Float32Array(data);
                },
                submit() {},
                async onSubmittedWorkDone() {},
            },
            addEventListener() {},
            removeEventListener() {},
            destroy() { this.destroyed = true; },
            pushErrorScope() { state.errorScopeDepth += 1; },
            popErrorScope() {
                state.errorScopeDepth -= 1;
                return Promise.resolve(null);
            },
            createShaderModule: ({ code }) => ({
                getCompilationInfo: async () => ({
                    messages: code === "invalid"
                        ? [{ type: "error", lineNum: 2, linePos: 3, message: "test WGSL error" }]
                        : [],
                }),
            }),
            createRenderPipelineAsync: async (descriptor) => {
                state.pipelineCount += 1;
                state.pipelineEntries.push({
                    vertex: descriptor.vertex.entryPoint,
                    fragment: descriptor.fragment?.entryPoint,
                    hasVertexBuffers: Boolean(descriptor.vertex.buffers),
                });
                return { getBindGroupLayout: () => ({}) };
            },
            createBuffer: ({ usage, size }) => {
                if (usage & 1) assert.ok([224, 144].includes(size));
                const uniform = Boolean(usage & 1) && size === 224 && !state.cameraCreated;
                if (uniform) state.cameraCreated = true;
                return { uniform, destroy() {} };
            },
            createBindGroup: () => ({}),
            createSampler: () => ({}),
            createTexture: () => ({ destroy() {}, createView: () => ({}) }),
            createCommandEncoder: () => ({
                beginRenderPass: () => ({
                    setPipeline() {}, setBindGroup() {}, setVertexBuffer() {}, draw() {}, end() {},
                }),
                finish: () => ({}),
            }),
        };
        return { device, lose, state };
    }

    const first = fakeDevice();
    const second = fakeDevice();
    const devices = [first.device, second.device];
    setBrowserGlobals(t, true, {
        requestAdapter: async () => ({ requestDevice: async () => devices.shift() }),
        getPreferredCanvasFormat: () => "bgra8unorm",
    });
    t.after(() => {
        stop();
        for (const name of globals) {
            const descriptor = originals.get(name);
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else delete globalThis[name];
        }
    });

    const canvas = {
        getBoundingClientRect: () => ({ width: 800, height: 600 }),
        getContext: () => ({
            configure() {}, unconfigure() {},
            getCurrentTexture: () => ({ createView: () => ({}) }),
        }),
    };
    const statuses = [];
    const cameraScene = { boxes: [], camera: createCamera() };
    const timings = [];
    assert.equal((await start(canvas, cameraScene, (status) => statuses.push(status), (timing) => timings.push(timing))).ready, true);
    assert.equal(getDefaultShaderSource(), defaultShaderSource);
    assert.equal(getShaderSource(), defaultShaderSource);

    const shaderStatuses = [];
    updateShader("invalid", (status) => shaderStatuses.push(status));
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.match(shaderStatuses.at(-1), /last working shader remains active.*line 2:3: test WGSL error/s);
    assert.equal(first.state.pipelineCount, 1);
    assert.equal(first.state.errorScopeDepth, 0);
    assert.equal(getShaderSource(), defaultShaderSource);

    const editedSource = `${defaultShaderSource}\n// live edit`;
    updateShader(editedSource, (status) => shaderStatuses.push(status));
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(shaderStatuses.at(-1), "Shader compiled and applied.");
    assert.equal(first.state.pipelineCount, 2);
    assert.equal(first.state.errorScopeDepth, 0);
    assert.equal(getShaderSource(), editedSource);

    first.lose({ message: "simulated loss" });
    await Promise.resolve();

    assert.equal(statuses.at(-1).ready, false);
    assert.match(statuses.at(-1).message, /device lost: simulated loss/i);
    assert.equal(first.device.destroyed, true);
    assert.equal((await start(canvas, cameraScene, (status) => statuses.push(status), (timing) => timings.push(timing))).ready, true);
    assert.notEqual(second.device.destroyed, true);
    const rayModeStatuses = [];
    assert.equal(await setRenderMode("raymarch", (status) => rayModeStatuses.push(status)), raymarchShaderSource);
    assert.equal(getRenderMode(), "raymarch");
    assert.equal(getShaderSource(), raymarchShaderSource);
    assert.equal(getDefaultShaderSource(), raymarchShaderSource);
    assert.equal(second.state.pipelineCount, 2);
    assert.deepEqual(second.state.pipelineEntries.at(-1), {
        vertex: "rayVertexMain",
        fragment: "rayFragmentMain",
        hasVertexBuffers: false,
    });
    assert.equal(rayModeStatuses.at(-1), "Ray-marched SDF vent wall active.");

    for (const size of [0, 0.125, 0.5, 1]) {
        setLightSize(size);
        scheduledFrame();
        assert.equal(getLightSize(), size);
        assert.equal(second.state.uniforms.length, 56);
        assert.equal(second.state.uniforms[44], size);
        assert.equal(second.state.pipelineCount, 2, "light size does not recompile the shader");
    }
    const hatchFeatures = [
        ["flushHatch", 48],
        ["recessedHatch", 49],
        ["controlPanel", 50],
        ["overheadFixture", 51],
        ["lightEmission", 52],
        ["localLight", 53],
    ];
    for (const [name, offset] of hatchFeatures) {
        assert.equal(getShaderFeatures()[name], true);
        for (const enabled of [false, true]) {
            setShaderFeature(name, enabled);
            scheduledFrame();
            assert.equal(second.state.uniforms[offset], enabled ? 1 : 0);
            for (const [otherName, otherOffset] of hatchFeatures) {
                if (name !== otherName) assert.equal(second.state.uniforms[otherOffset], 1);
            }
            assert.equal(second.state.pipelineCount, 2, "hatch steps do not recompile");
        }
        assert.throws(() => setShaderFeature(name, "true"), RangeError);
        assert.equal(getShaderFeatures()[name], true);
    }
    setLightAnimationSpeed(0.25);
    for (const speed of [0, 1.1, NaN, Infinity, "0.5"]) {
        assert.throws(() => setLightAnimationSpeed(speed), RangeError);
    }
    assert.throws(() => setLightAnimation("true"), RangeError);
    setLightAnimation(true);
    scheduledFrame(0);
    const requestsBefore = frameRequests;
    scheduledFrame(1000);
    assert.equal(frameRequests, requestsBefore + 1, "animation schedules another frame");
    assert.ok(Math.abs(second.state.uniforms[54] - 0.32) < 0.00001);
    assert.match(timings.at(-1), /not GPU execution time/);
    assert.equal(second.state.pipelineCount, 2, "motion does not compile a pipeline");
    setLightAnimation(false);
    const frozenOffset = getLightAnimation().offset;
    const pausedRequests = frameRequests;
    scheduledFrame(5000);
    assert.equal(getLightAnimation().offset, frozenOffset);
    assert.equal(frameRequests, pausedRequests, "paused frame does not continue rendering");
    setLightAnimation(true);
    scheduledFrame(6000);
    assert.equal(getLightAnimation().offset, frozenOffset, "resume does not catch up paused time");
    globalThis.document.hidden = true;
    visibilityHandlers.get("visibilitychange")();
    const hiddenRequests = frameRequests;
    scheduledFrame(7000);
    assert.equal(frameRequests, hiddenRequests);
    globalThis.document.hidden = false;
    visibilityHandlers.get("visibilitychange")();
    scheduledFrame(10000);
    assert.equal(getLightAnimation().offset, frozenOffset, "hidden time does not advance motion");
    setShaderFeature("overheadFixture", false);
    const removedRequests = frameRequests;
    scheduledFrame(11000);
    assert.equal(frameRequests, removedRequests);
    setShaderFeature("overheadFixture", true);
    scheduledFrame(12000);
    assert.equal(getLightAnimation().offset, frozenOffset);
    setShaderFeature("localLight", false);
    for (const size of [-1, 1.01, NaN, Infinity, "0.5", null]) {
        assert.throws(() => setLightSize(size), RangeError);
        assert.equal(getLightSize(), 1);
    }
    assert.equal(getShaderFeatures().marching, true);
    assert.equal(getShaderFeatures().normals, true);
    assert.equal(getShaderFeatures().rayDebug, false);
    setShaderFeature("cutouts", false);
    assert.equal(getShaderFeatures().cutouts, false);
    setShaderFeature("marching", false);
    assert.equal(getShaderFeatures().marching, false);
    assert.throws(() => setShaderFeature("fakeDepth", false), /Unknown shader feature/);
    assert.equal(await setRenderMode("triangles"), editedSource);
    assert.throws(() => setShaderFeature("flushHatch", false), RangeError);
    assert.equal(getRenderMode(), "triangles");
    assert.equal(getShaderSource(), editedSource);
    assert.equal(second.state.pipelineCount, 2);
    assert.equal(getLightSize(), 1, "mode switches retain light size");
    const triangleRequests = frameRequests;
    scheduledFrame(15000);
    assert.equal(frameRequests, triangleRequests, "triangle mode does not animate");
    await setRenderMode("raymarch");
    assert.equal(getShaderFeatures().localLight, false, "hatch settings survive mode switches");
    setShaderFeature("localLight", true);
    scheduledFrame(20000);
    assert.equal(getLightAnimation().offset, frozenOffset, "mode switch does not catch up motion");
    setLightAnimation(false);
    setShaderFeature("lightFlicker", true);
    scheduledFrame(21000);
    const flickerStart = second.state.uniforms[55];
    const stationaryOffset = second.state.uniforms[54];
    const flickerRequests = frameRequests;
    scheduledFrame(22000);
    assert.equal(frameRequests, flickerRequests + 1, "flicker animates with movement paused");
    assert.notEqual(second.state.uniforms[55], flickerStart);
    assert.equal(second.state.uniforms[54], stationaryOffset);
    assert.equal(second.state.pipelineCount, 2, "flicker does not compile");
    setShaderFeature("overheadLight", false);
    const lightOffRequests = frameRequests;
    scheduledFrame(23000);
    assert.equal(frameRequests, lightOffRequests, "switched-off light does not flicker-render");
    assert.equal(second.state.uniforms[46], 0);
    setShaderFeature("directionalLight", false);
    scheduledFrame(24000);
    assert.equal(second.state.uniforms[45], 0);
    setShaderFeature("directionalLight", true);
    setShaderFeature("overheadLight", true);
    scheduledFrame(25000);
    setShaderFeature("lightFlicker", false);
    scheduledFrame(26000);
    assert.equal(second.state.uniforms[55], 1, "disabling flicker restores steady brightness");
    setShaderFeature("cutouts", true);
    setShaderFeature("marching", true);
    setShaderFeature("overheadShadows", false);
    scheduledFrame(26500);
    assert.equal(second.state.uniforms[31], 0);
    assert.equal(second.state.uniforms[46], 1, "shadow switch leaves overhead light on");
    await setRenderMode("reference");
    assert.equal(getShaderFeatures().overheadShadows, false, "shared switch survives reference mode change");
    setShaderFeature("overheadShadows", true);
    scheduledFrame(27000);
    assert.equal(second.state.pipelineCount, 5, "mesh, analytic floor, and depth-only pipelines compiled");
    assert.deepEqual(getComparisonSettings().shadowPassCounts, [1, 1]);
    assert.ok(getComparisonSettings().triangles > 0);
    setShaderFeature("lightFlicker", true);
    scheduledFrame(28000);
    scheduledFrame(29000);
    assert.deepEqual(getComparisonSettings().shadowPassCounts, [1, 1], "brightness-only flicker reuses both maps");
    setLightAnimation(true);
    scheduledFrame(30000);
    scheduledFrame(31000);
    assert.deepEqual(getComparisonSettings().shadowPassCounts, [2, 2], "motion refreshes both affected maps");
    setShaderFeature("overheadShadows", false);
    scheduledFrame(31200);
    assert.equal(second.state.uniforms[31], 0);
    assert.deepEqual(getComparisonSettings().shadowPassCounts, [3, 2], "main map updates while overhead shadows are off");
    setShaderFeature("overheadShadows", true);
    scheduledFrame(31200);
    assert.equal(second.state.uniforms[31], 1);
    assert.deepEqual(getComparisonSettings().shadowPassCounts, [3, 3], "overhead map catches up without rebuilding main map");
    setShaderFeature("directionalLight", false);
    scheduledFrame(32000);
    assert.deepEqual(getComparisonSettings().shadowPassCounts, [3, 4], "disabled light skips its map");
    setShaderFeature("directionalLight", true);
    scheduledFrame(33000);
    assert.deepEqual(getComparisonSettings().shadowPassCounts, [4, 5], "re-enabled light refreshes stale occlusion");
    setLightAnimation(false);
    setShaderFeature("lightFlicker", false);
    setGreebleCount(128);
    scheduledFrame(34000);
    assert.equal(second.state.uniforms[47], 128);
    assert.deepEqual(getComparisonSettings().shadowPassCounts, [5, 6], "geometry changes invalidate both maps");
    setRenderScale(0.5);
    assert.deepEqual([canvas.width, canvas.height], [400, 300]);
    setShadowResolution(256);
    scheduledFrame(35000);
    assert.equal(second.state.pipelineCount, 5, "resolution controls do not recompile");
    assert.deepEqual(getComparisonSettings().shadowPassCounts, [6, 7]);
    const beforeComparison = getComparisonSettings();
    const results = await runComparison();
    assert.equal(results.length, 6);
    assert.deepEqual(results.map(({ mode, greebles }) => [mode, greebles]),
        [0, 32, 128].flatMap((count) => [["raymarch", count], ["reference", count]]));
    assert.ok(results.every((result) => result.width === 400 && result.height === 300 && result.medianMs >= 0));
    assert.equal(getRenderMode(), "reference");
    assert.equal(getComparisonSettings().greebleCount, beforeComparison.greebleCount);
    second.device.queue.onSubmittedWorkDone = async () => { canvas.width = 401; };
    await assert.rejects(runComparison(), /Viewport changed/);
    assert.equal(getRenderMode(), "reference");
    assert.equal(getComparisonSettings().greebleCount, 128, "failed comparison restores detail count");
    canvas.width = 400;
    second.device.queue.onSubmittedWorkDone = async () => {};
    globalThis.document.hidden = true;
    await assert.rejects(runComparison(), /Keep the app visible/);
    globalThis.document.hidden = false;
    const target = [...cameraScene.camera.target];
    second.device.queue.onSubmittedWorkDone = async () => { cameraScene.camera.target[0] = 5; };
    await assert.rejects(runComparison(), /Camera or lighting settings changed/);
    cameraScene.camera.target = target;
    second.device.queue.onSubmittedWorkDone = async () => {};
    const beforeClutter = getComparisonSettings();
    setShaderFeature("hatchClutter", true);
    scheduledFrame(36000);
    assert.equal(second.state.uniforms[27], 1);
    assert.ok(getComparisonSettings().triangles > beforeClutter.triangles);
    assert.deepEqual(getComparisonSettings().shadowPassCounts, beforeClutter.shadowPassCounts.map((count) => count + 1));
    await setRenderMode("raymarch");
    assert.equal(getShaderFeatures().hatchClutter, true);
    scheduledFrame(37000);
    assert.equal(second.state.uniforms[27], 1);
    await setRenderMode("reference");
    setShaderFeature("hatchClutter", false);
    scheduledFrame(38000);
    assert.equal(second.state.uniforms[27], 0);
    assert.equal(getComparisonSettings().triangles, beforeClutter.triangles);
    const beforeIntensity = getComparisonSettings().shadowPassCounts;
    for (const intensity of [0, 0.5, 2, 4, 1]) {
        setOverheadIntensity(intensity);
        scheduledFrame(39000);
        assert.equal(getOverheadIntensity(), intensity);
        assert.equal(second.state.uniforms[55], intensity);
        assert.deepEqual(getComparisonSettings().shadowPassCounts, beforeIntensity, "brightness-only adjustment reuses maps");
    }
    setShaderFeature("lightFlicker", true);
    setOverheadIntensity(0);
    const zeroRequests = frameRequests;
    scheduledFrame(40000);
    assert.equal(frameRequests, zeroRequests, "zero brightness stops flicker-only rendering");
    assert.equal(second.state.uniforms[55], 0);
    setOverheadIntensity(2);
    scheduledFrame(41000);
    scheduledFrame(42000);
    assert.ok(second.state.uniforms[55] >= 1.4 && second.state.uniforms[55] <= 2);
    await setRenderMode("raymarch");
    assert.equal(getOverheadIntensity(), 2);
    assert.equal(getShaderFeatures().lightFlicker, true);
    setShaderFeature("lightFlicker", false);
    setOverheadIntensity(1);
    for (const invalid of [-1, 4.1, NaN, Infinity, "1", null]) {
        assert.throws(() => setOverheadIntensity(invalid), RangeError);
    }
    setRenderScale(1);
    setShadowResolution(512);
    setGreebleCount(0);
    for (const invalid of [-1, 2, NaN, "0.5"]) assert.throws(() => setRenderScale(invalid), RangeError);
    for (const invalid of [-1, 1, 64, "32"]) assert.throws(() => setGreebleCount(invalid), RangeError);
    for (const invalid of [0, 4096, "256"]) assert.throws(() => setShadowResolution(invalid), RangeError);
    await setRenderMode("triangles");
    setLightSize(0.125);
    stop();
    assert.equal(visibilityHandlers.size, 0);
});
