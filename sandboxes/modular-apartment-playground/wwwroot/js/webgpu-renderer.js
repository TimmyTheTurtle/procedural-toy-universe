import { getCameraFrame } from "./scene-model.js";

const shaderCode = `
struct Camera {
    viewProjection: mat4x4<f32>,
};

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec4<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: Camera;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.position = camera.viewProjection * vec4<f32>(input.position, 1.0);
    output.normal = input.normal;
    output.color = input.color;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let lightDirection = normalize(vec3<f32>(0.45, 0.82, 0.36));
    let diffuse = max(dot(normalize(input.normal), lightDirection), 0.0);
    let illumination = 0.34 + 0.66 * diffuse;
    return vec4<f32>(input.color.rgb * illumination, input.color.a);
}
`;

const faceDefinitions = [
    { normal: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { normal: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { normal: [1, 0, 0], corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { normal: [-1, 0, 0], corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
    { normal: [0, 1, 0], corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { normal: [0, -1, 0], corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
];
const triangleCorners = [0, 1, 2, 0, 2, 3];
const vertexStride = 10;

let canvas;
let context;
let device;
let pipeline;
let bindGroup;
let vertexBuffer;
let uniformBuffer;
let depthTexture;
let resizeObserver;
let statusCallback;
let scene;
let vertexCount = 0;
let vertexCapacity = 0;
let animationFrame = 0;
let renderFailed = false;
let firstFrameSubmitted = false;

function messageFor(error) {
    return error instanceof Error ? error.message : String(error);
}

function publishStatus(ready, message) {
    statusCallback?.({ ready, message });
}

function onUncapturedError(event) {
    renderFailed = true;
    const error = event.error;
    publishStatus(false, `WebGPU reported an error: ${error.message || error.constructor.name}. Retry graphics to preserve the current scene.`);
}

export function createSceneVertices(sceneData) {
    const vertices = [];

    for (const box of sceneData.boxes) {
        const [centerX, centerY, centerZ] = box.center;
        const [sizeX, sizeY, sizeZ] = box.size;
        const radians = (box.rotationDegrees || 0) * Math.PI / 180;
        const cosine = Math.cos(radians);
        const sine = Math.sin(radians);

        for (const face of faceDefinitions) {
            const normalX = face.normal[0] * cosine + face.normal[2] * sine;
            const normalZ = -face.normal[0] * sine + face.normal[2] * cosine;
            for (const cornerIndex of triangleCorners) {
                const corner = face.corners[cornerIndex];
                const localX = corner[0] * sizeX / 2;
                const localZ = corner[2] * sizeZ / 2;
                vertices.push(
                    centerX + localX * cosine + localZ * sine,
                    centerY + corner[1] * sizeY / 2,
                    centerZ - localX * sine + localZ * cosine,
                    normalX,
                    face.normal[1],
                    normalZ,
                    box.color[0],
                    box.color[1],
                    box.color[2],
                    1,
                );
            }
        }
    }

    return new Float32Array(vertices);
}

async function createPipeline(format) {
    const shaderModule = device.createShaderModule({ code: shaderCode });
    pipeline = await device.createRenderPipelineAsync({
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vertexMain",
            buffers: [{
                arrayStride: vertexStride * Float32Array.BYTES_PER_ELEMENT,
                attributes: [
                    { shaderLocation: 0, offset: 0, format: "float32x3" },
                    { shaderLocation: 1, offset: 12, format: "float32x3" },
                    { shaderLocation: 2, offset: 24, format: "float32x4" },
                ],
            }],
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragmentMain",
            targets: [{ format }],
        },
        primitive: {
            topology: "triangle-list",
            cullMode: "none",
        },
        depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less",
        },
    });
}

function createVertexBuffer() {
    uniformBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });
    uploadScene();
}

function uploadScene() {
    const vertices = createSceneVertices(scene);
    vertexCount = vertices.length / vertexStride;
    if (vertices.byteLength > vertexCapacity) {
        vertexBuffer?.destroy();
        vertexCapacity = Math.max(vertices.byteLength, vertexCapacity * 2, 4);
        vertexBuffer = device.createBuffer({
            size: vertexCapacity,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
    }
    if (vertices.byteLength > 0) {
        device.queue.writeBuffer(vertexBuffer, 0, vertices);
    }
}

function normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]);
    return vector.map((value) => value / length);
}

function cross(left, right) {
    return [
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    ];
}

function dot(left, right) {
    return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function lookAt(eye, target) {
    const zAxis = normalize([
        eye[0] - target[0],
        eye[1] - target[1],
        eye[2] - target[2],
    ]);
    const xAxis = normalize(cross([0, 1, 0], zAxis));
    const yAxis = cross(zAxis, xAxis);

    return new Float32Array([
        xAxis[0], yAxis[0], zAxis[0], 0,
        xAxis[1], yAxis[1], zAxis[1], 0,
        xAxis[2], yAxis[2], zAxis[2], 0,
        -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
    ]);
}

function perspective(fieldOfView, aspect, near, far) {
    const scale = 1 / Math.tan(fieldOfView / 2);
    const range = near - far;

    return new Float32Array([
        scale / aspect, 0, 0, 0,
        0, scale, 0, 0,
        0, 0, far / range, -1,
        0, 0, near * far / range, 0,
    ]);
}

function multiplyMatrices(left, right) {
    const result = new Float32Array(16);

    for (let column = 0; column < 4; column += 1) {
        for (let row = 0; row < 4; row += 1) {
            result[column * 4 + row] =
                left[row] * right[column * 4] +
                left[4 + row] * right[column * 4 + 1] +
                left[8 + row] * right[column * 4 + 2] +
                left[12 + row] * right[column * 4 + 3];
        }
    }

    return result;
}

function updateCameraUniform() {
    const { camera } = scene;
    const { eye } = getCameraFrame(camera);
    const view = lookAt(eye, camera.target);
    const projection = perspective(
        Math.PI / 4,
        canvas.width / canvas.height,
        0.1,
        100,
    );
    device.queue.writeBuffer(uniformBuffer, 0, multiplyMatrices(projection, view));
}

function resizeCanvas() {
    if (!device || !canvas || !context) {
        return;
    }

    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const maxDimension = device.limits.maxTextureDimension2D;
    const width = Math.min(Math.max(1, Math.round(bounds.width * pixelRatio)), maxDimension);
    const height = Math.min(Math.max(1, Math.round(bounds.height * pixelRatio)), maxDimension);

    if (depthTexture && canvas.width === width && canvas.height === height) {
        return;
    }

    canvas.width = width;
    canvas.height = height;
    depthTexture?.destroy();
    depthTexture = device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    scheduleRender();
}

function drawFrame() {
    animationFrame = 0;
    if (!device || !pipeline || !context || !depthTexture || renderFailed) {
        return;
    }

    try {
        updateCameraUniform();
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.92, g: 0.95, b: 0.97, a: 1 },
                loadOp: "clear",
                storeOp: "store",
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1,
                depthLoadOp: "clear",
                depthStoreOp: "discard",
            },
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.draw(vertexCount);
        pass.end();
        device.queue.submit([encoder.finish()]);
        if (!firstFrameSubmitted) {
            firstFrameSubmitted = true;
            publishStatus(true, "WebGPU renderer ready.");
        }
    } catch (error) {
        renderFailed = true;
        publishStatus(false, `WebGPU rendering failed: ${messageFor(error)}. Retry graphics to preserve the current scene.`);
    }
}

function scheduleRender() {
    if (!animationFrame && !renderFailed) {
        animationFrame = window.requestAnimationFrame(drawFrame);
    }
}

async function initialize() {
    if (!globalThis.isSecureContext) {
        return { ready: false, message: "WebGPU requires a secure context. Open this page from localhost or HTTPS." };
    }

    if (!navigator.gpu) {
        return { ready: false, message: "WebGPU is not available in this browser. Check browser support and settings." };
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        return { ready: false, message: "No compatible WebGPU adapter was found on this device." };
    }

    device = await adapter.requestDevice();
    device.addEventListener("uncapturederror", onUncapturedError);
    const activeDevice = device;
    activeDevice.lost.then((info) => {
        if (device !== activeDevice) {
            return;
        }

        renderFailed = true;
        const status = `WebGPU device lost: ${info.message || info.reason || "unknown reason"}. Retry graphics to preserve the current scene.`;
        publishStatus(false, status);
        cleanupResources();
    });

    context = canvas.getContext("webgpu");
    if (!context) {
        return { ready: false, message: "The browser could not create a WebGPU canvas context." };
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "opaque" });
    await createPipeline(format);
    createVertexBuffer();
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
    resizeCanvas();
    scheduleRender();

    return { ready: true, message: "WebGPU renderer ready." };
}

export async function start(canvasElement, sceneData, onStatus) {
    cleanupResources();
    canvas = canvasElement;
    statusCallback = onStatus;
    scene = sceneData;
    renderFailed = false;
    firstFrameSubmitted = false;

    try {
        const result = await initialize();
        if (!result.ready) {
            cleanupResources();
        }
        return result;
    } catch (error) {
        cleanupResources();
        const status = `WebGPU initialization failed: ${messageFor(error)}`;
        console.error(status, error);
        return { ready: false, message: status };
    }
}

export function updateScene(sceneData) {
    if (!device || renderFailed) {
        throw new Error("WebGPU renderer is not ready.");
    }
    scene = sceneData;
    uploadScene();
    scheduleRender();
}

export function render() {
    if (!device || renderFailed) {
        throw new Error("WebGPU renderer is not ready.");
    }
    scheduleRender();
}

function cleanupResources() {
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
    }
    depthTexture?.destroy();
    depthTexture = undefined;
    const oldDevice = device;
    device = undefined;
    oldDevice?.removeEventListener("uncapturederror", onUncapturedError);
    vertexBuffer?.destroy();
    vertexBuffer = undefined;
    uniformBuffer?.destroy();
    uniformBuffer = undefined;
    context?.unconfigure();
    context = undefined;
    oldDevice?.destroy();
    pipeline = undefined;
    bindGroup = undefined;
    statusCallback = undefined;
    canvas = undefined;
    scene = undefined;
    vertexCount = 0;
    vertexCapacity = 0;
    firstFrameSubmitted = false;
}

export function stop() {
    cleanupResources();
}
