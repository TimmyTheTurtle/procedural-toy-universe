import assert from "node:assert/strict";
import test from "node:test";
import { start, stop } from "../wwwroot/js/webgpu-renderer.js";

function setBrowserGlobals(t, secure, gpu) {
    const originalSecure = Object.getOwnPropertyDescriptor(globalThis, "isSecureContext");
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value: secure });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { gpu } });
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
    const globals = ["window", "ResizeObserver", "GPUBufferUsage", "GPUTextureUsage"];
    const originals = new Map(globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    const replacements = {
        window: { devicePixelRatio: 1, requestAnimationFrame: () => 1, cancelAnimationFrame() {} },
        ResizeObserver: class { observe() {} disconnect() {} },
        GPUBufferUsage: { UNIFORM: 1, COPY_DST: 2, VERTEX: 4 },
        GPUTextureUsage: { RENDER_ATTACHMENT: 1 },
    };
    for (const [name, value] of Object.entries(replacements)) {
        Object.defineProperty(globalThis, name, { configurable: true, value });
    }

    function fakeDevice() {
        let lose;
        const device = {
            lost: new Promise((resolve) => { lose = resolve; }),
            limits: { maxTextureDimension2D: 4096 },
            queue: { writeBuffer() {} },
            addEventListener() {},
            removeEventListener() {},
            destroy() { this.destroyed = true; },
            createShaderModule: () => ({}),
            createRenderPipelineAsync: async () => ({ getBindGroupLayout: () => ({}) }),
            createBuffer: () => ({ destroy() {} }),
            createBindGroup: () => ({}),
            createTexture: () => ({ destroy() {} }),
        };
        return { device, lose };
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
        getContext: () => ({ configure() {}, unconfigure() {} }),
    };
    const statuses = [];
    assert.equal((await start(canvas, scene, (status) => statuses.push(status))).ready, true);
    first.lose({ message: "simulated loss" });
    await Promise.resolve();

    assert.equal(statuses.at(-1).ready, false);
    assert.match(statuses.at(-1).message, /device lost: simulated loss/i);
    assert.equal(first.device.destroyed, true);
    assert.equal((await start(canvas, scene, (status) => statuses.push(status))).ready, true);
    assert.notEqual(second.device.destroyed, true);
});
