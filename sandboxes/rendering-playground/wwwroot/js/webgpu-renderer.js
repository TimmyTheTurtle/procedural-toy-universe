import { getCameraFrame } from "./scene-model.js";
import { createReferenceVertices, greebleGrid, REFERENCE_VERTEX_STRIDE } from "./reference-scene.js";

const renderModes = {
    triangles: {
        shaderPath: "../shaders/procedural-vent-grill.wgsl",
        vertexEntry: "vertexMain",
        fragmentEntry: "fragmentMain",
    },
    raymarch: {
        shaderPath: "../shaders/raymarched-vent-wall.wgsl",
        vertexEntry: "rayVertexMain",
        fragmentEntry: "rayFragmentMain",
    },
    utility: {
        shaderPath: "../shaders/raymarched-maintenance-bay.wgsl",
        vertexEntry: "utilityVertexMain",
        fragmentEntry: "utilityFragmentMain",
    },
    reference: {
        shaderPath: "../shaders/reference-mesh.wgsl",
        vertexEntry: "meshVertexMain",
        fragmentEntry: "meshFragmentMain",
    },
};

const faceDefinitions = [
    { normal: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { normal: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { normal: [1, 0, 0], corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { normal: [-1, 0, 0], corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
    { normal: [0, 1, 0], corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { normal: [0, -1, 0], corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
];
const triangleCorners = [0, 1, 2, 0, 2, 3];
const vertexStride = 13;

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
let shaderUpdateTimer = 0;
let shaderRevision = 0;
let shaderCompileTask = Promise.resolve();
let renderFailed = false;
let firstFrameSubmitted = false;
let renderMode = "triangles";
let proceduralPatternEnabled = false;
let lightSize = 0.125;
let overheadIntensity = 1;
let utilityArcEnabled = true;
let utilityArcBrightness = 8;
let utilityTime = 0;
let lightAnimationEnabled = false;
let lightAnimationSpeed = 0.25;
let lightPhase = 0;
let flickerTime = 0;
let previousAnimationTimestamp;
let timingElapsed = 0;
let timingFrames = 0;
let timingCallback;
let renderScale = 1;
let shadowResolution = 512;
let greebleCount = 0;
let referenceResources;
let referenceGeometryDirty = true;
let benchmarkRunning = false;
let shadowPassCounts = [0, 0];
const defaultShaderSources = {};
const activeShaderSources = {};
const pipelines = {};
const bindGroups = {};
let pipelineFormat;
const shaderFeatures = {
    triangles: {
        lighting: true,
        frame: true,
        slots: true,
        edgeSmoothing: true,
        fakeDepth: true,
    },
    raymarch: {
        cutouts: true,
        frame: true,
        slats: true,
        lighting: true,
        softShadows: true,
        ambientOcclusion: true,
        marching: true,
        normals: true,
        rayDebug: false,
        flushHatch: true,
        recessedHatch: true,
        controlPanel: true,
        overheadFixture: true,
        lightEmission: true,
        localLight: true,
        directionalLight: true,
        overheadLight: true,
        overheadShadows: true,
        hatchClutter: false,
        lightFlicker: false,
    },
};
shaderFeatures.reference = shaderFeatures.raymarch;

function messageFor(error) {
    return error instanceof Error ? error.message : String(error);
}

function publishStatus(ready, message) {
    statusCallback?.({ ready, message });
}

async function loadDefaultShader(mode) {
    const config = renderModes[mode];
    if (!config) {
        throw new RangeError(`Unknown renderer mode: ${mode}.`);
    }

    const response = await fetch(new URL(config.shaderPath, import.meta.url));
    if (!response.ok) {
        throw new Error(`Could not load the ${mode} WGSL file (HTTP ${response.status}).`);
    }

    let source = await response.text();
    if (mode === "reference") {
        if (!defaultShaderSources.raymarch) await loadDefaultShader("raymarch");
        source = defaultShaderSources.raymarch.replace("fn shadowVisibility(", "fn sdfShadowVisibility(") + "\n" + source;
    }
    if (source.trim() === "") {
        throw new Error(`The ${mode} WGSL file is empty.`);
    }

    defaultShaderSources[mode] = source;
    if (!activeShaderSources[mode]) {
        activeShaderSources[mode] = source;
    }
    return source;
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
            const patternMask = box.id === "preview" || box.id?.startsWith("wall-") ? 1 : 0;
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
                    localX,
                    corner[1] * sizeY / 2 + sizeY / 2,
                    patternMask,
                );
            }
        }
    }

    return new Float32Array(vertices);
}

async function createPipeline(format, source, mode = renderMode) {
    const config = renderModes[mode];
    if (!config) {
        throw new RangeError(`Unknown renderer mode: ${mode}.`);
    }
    const usesErrorScopes = typeof device.pushErrorScope === "function" &&
        typeof device.popErrorScope === "function";
    if (usesErrorScopes) {
        device.pushErrorScope("validation");
    }

    let shaderModule;
    try {
        shaderModule = device.createShaderModule({ code: source });
    } catch (error) {
        const validationError = usesErrorScopes ? await device.popErrorScope() : undefined;
        throw validationError ?? error;
    }

    let compilationInfo;
    if (shaderModule.getCompilationInfo) {
        try {
            compilationInfo = await shaderModule.getCompilationInfo();
        } catch (error) {
            const validationError = usesErrorScopes ? await device.popErrorScope() : undefined;
            throw validationError ?? error;
        }
    }
    const moduleValidationError = usesErrorScopes ? await device.popErrorScope() : undefined;
    if (compilationInfo) {
        const errors = compilationInfo.messages
            .filter((message) => message.type === "error")
            .map((message) => {
                const location = message.lineNum
                    ? `line ${message.lineNum}${message.linePos ? `:${message.linePos}` : ""}: `
                    : "";
                return `${location}${message.message}`;
            });
        if (errors.length > 0) {
            throw new Error(errors.join("\n"));
        }
    }
    if (moduleValidationError) {
        throw new Error(moduleValidationError.message || "WGSL shader module validation failed.");
    }

    if (usesErrorScopes) {
        device.pushErrorScope("validation");
    }
    let candidatePipeline;
    const vertex = {
        module: shaderModule,
        entryPoint: config.vertexEntry,
    };
    if (mode === "reference") {
        vertex.buffers = [{
            arrayStride: REFERENCE_VERTEX_STRIDE * 4,
            attributes: [
                { shaderLocation: 0, offset: 0, format: "float32x3" },
                { shaderLocation: 1, offset: 12, format: "float32x3" },
                { shaderLocation: 2, offset: 24, format: "float32" },
                { shaderLocation: 3, offset: 28, format: "float32" },
            ],
        }];
    } else if (mode === "triangles") {
        vertex.buffers = [{
            arrayStride: vertexStride * Float32Array.BYTES_PER_ELEMENT,
            attributes: [
                { shaderLocation: 0, offset: 0, format: "float32x3" },
                { shaderLocation: 1, offset: 12, format: "float32x3" },
                { shaderLocation: 2, offset: 24, format: "float32x4" },
                { shaderLocation: 3, offset: 40, format: "float32x2" },
                { shaderLocation: 4, offset: 48, format: "float32" },
            ],
        }];
    }
    let floorPipeline;
    let shadowPipeline;
    try {
        candidatePipeline = await device.createRenderPipelineAsync({
            layout: "auto",
            vertex,
            fragment: {
                module: shaderModule,
                entryPoint: config.fragmentEntry,
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
        if (mode === "reference") {
            floorPipeline = await device.createRenderPipelineAsync({
                layout: "auto",
                vertex: { module: shaderModule, entryPoint: "rayVertexMain" },
                fragment: { module: shaderModule, entryPoint: "meshFloorMain", targets: [{ format }] },
                primitive: { topology: "triangle-list" },
                depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less-equal" },
            });
            shadowPipeline = await device.createRenderPipelineAsync({
                layout: "auto",
                vertex: { ...vertex, entryPoint: "shadowVertexMain" },
                primitive: { topology: "triangle-list", cullMode: "none" },
                depthStencil: {
                    format: "depth32float", depthWriteEnabled: true, depthCompare: "less",
                    depthBias: 2, depthBiasSlopeScale: 1,
                },
            });
        }
    } catch (error) {
        const validationError = usesErrorScopes ? await device.popErrorScope() : undefined;
        throw validationError ?? error;
    }

    const pipelineValidationError = usesErrorScopes ? await device.popErrorScope() : undefined;
    if (pipelineValidationError) {
        throw new Error(pipelineValidationError.message || "WGSL pipeline validation failed.");
    }
    return { main: candidatePipeline, floor: floorPipeline, shadow: shadowPipeline };
}

function createBindGroup(targetPipeline = pipeline) {
    const main = device.createBindGroup({
        layout: targetPipeline.main.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });
    if (!targetPipeline.floor) return { main };
    ensureReferenceResources();
    const resources = referenceResources;
    const mapEntries = [
        { binding: 0, resource: { buffer: resources.settings } },
        { binding: 1, resource: resources.maps[0].createView() },
        { binding: 2, resource: resources.maps[1].createView() },
        { binding: 3, resource: resources.sampler },
    ];
    return {
        main,
        floor: device.createBindGroup({
            layout: targetPipeline.floor.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        }),
        maps: device.createBindGroup({ layout: targetPipeline.main.getBindGroupLayout(1), entries: mapEntries }),
        floorMaps: device.createBindGroup({ layout: targetPipeline.floor.getBindGroupLayout(1), entries: mapEntries }),
        shadows: resources.lightBuffers.map((buffer) => device.createBindGroup({
            layout: targetPipeline.shadow.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer } }],
        })),
    };
}

function ensureReferenceResources() {
    if (referenceResources) return;
    if (shadowResolution > device.limits.maxTextureDimension2D) {
        throw new RangeError("Shadow map resolution exceeds this device's texture limit.");
    }
    referenceResources = {
        settings: device.createBuffer({ size: 144, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
        lightBuffers: [0, 1].map(() => device.createBuffer({
            size: 224, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })),
        maps: [0, 1].map(() => device.createTexture({
            size: [shadowResolution, shadowResolution], format: "depth32float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        })),
        sampler: device.createSampler({ compare: "less-equal", magFilter: "linear", minFilter: "linear" }),
        keys: [null, null],
        buffers: [],
        counts: [],
    };
    referenceGeometryDirty = true;
}

function uploadReference() {
    ensureReferenceResources();
    if (!referenceGeometryDirty) return;
    const vertices = createReferenceVertices(shaderFeatures.raymarch, greebleCount);
    const staticVertices = [];
    for (let offset = 0; offset < vertices.length; offset += REFERENCE_VERTEX_STRIDE) {
        if (vertices[offset + 7] === 0) staticVertices.push(...vertices.subarray(offset, offset + REFERENCE_VERTEX_STRIDE));
    }
    referenceResources.buffers.forEach((buffer) => buffer.destroy());
    const arrays = [vertices, new Float32Array(staticVertices)];
    referenceResources.buffers = arrays.map((array) => {
        const buffer = device.createBuffer({
            size: Math.max(4, array.byteLength), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        if (array.byteLength) device.queue.writeBuffer(buffer, 0, array);
        return buffer;
    });
    referenceResources.counts = arrays.map((array) => array.length / REFERENCE_VERTEX_STRIDE);
    referenceResources.keys = [null, null];
    referenceGeometryDirty = false;
}

async function createScopedBindGroup(targetPipeline) {
    const activeDevice = device;
    const usesErrorScopes = typeof activeDevice.pushErrorScope === "function" &&
        typeof activeDevice.popErrorScope === "function";
    if (usesErrorScopes) {
        activeDevice.pushErrorScope("validation");
    }

    let nextBindGroup;
    try {
        nextBindGroup = createBindGroup(targetPipeline);
    } catch (error) {
        const validationError = usesErrorScopes ? await activeDevice.popErrorScope() : undefined;
        throw validationError ?? error;
    }

    const validationError = usesErrorScopes ? await activeDevice.popErrorScope() : undefined;
    if (validationError) {
        throw new Error(validationError.message || "Shader bind group validation failed.");
    }
    return nextBindGroup;
}

function createVertexBuffer() {
    uniformBuffer = device.createBuffer({
        size: 224,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
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

function orthographic(size, near, far) {
    return new Float32Array([
        1 / size, 0, 0, 0, 0, 1 / size, 0, 0,
        0, 0, 1 / (near - far), 0, 0, 0, near / (near - far), 1,
    ]);
}

function updateShadowMaps(encoder) {
    uploadReference();
    const resources = referenceResources;
    const offset = Math.sin(lightPhase) * 0.32;
    const direction = normalize([-0.45, 0.82, 0.6]);
    const target = [0, 1.2, 0];
    const mainMatrix = multiplyMatrices(orthographic(4.5, 0.1, 14),
        lookAt(target.map((value, axis) => value + direction[axis] * 7), target));
    const light = [1.3 + offset, 1.225, 0.18];
    // A 170-degree perspective covers the full downward beam, not a cube-map point light.
    const localMatrix = multiplyMatrices(perspective(170 * Math.PI / 180, 1, 0.015, 32),
        lookAt(light, [light[0], light[1] - 1, light[2] + 0.35]));
    const settings = new Float32Array(36);
    settings.set(mainMatrix);
    settings.set(localMatrix, 16);
    settings[32] = shadowResolution;
    device.queue.writeBuffer(resources.settings, 0, settings);
    const features = shaderFeatures.raymarch;
    const enabled = [
        features.softShadows && features.lighting && features.directionalLight,
        features.softShadows && features.overheadShadows && overheadIntensity > 0 && features.lighting && features.overheadLight &&
            features.overheadFixture && features.localLight,
    ];
    for (let index = 0; index < 2; index += 1) {
        const key = index === 0 && !features.overheadFixture ? 0 : offset;
        if (!enabled[index] || resources.keys[index] === key) continue;
        const uniforms = new Float32Array(56);
        uniforms.set(index === 0 ? mainMatrix : localMatrix);
        uniforms[54] = offset;
        device.queue.writeBuffer(resources.lightBuffers[index], 0, uniforms);
        const pass = encoder.beginRenderPass({
            colorAttachments: [],
            depthStencilAttachment: {
                view: resources.maps[index].createView(), depthClearValue: 1,
                depthLoadOp: "clear", depthStoreOp: "store",
            },
        });
        pass.setPipeline(pipeline.shadow);
        pass.setBindGroup(0, bindGroup.shadows[index]);
        pass.setVertexBuffer(0, resources.buffers[index]);
        pass.draw(resources.counts[index]);
        pass.end();
        resources.keys[index] = key;
        shadowPassCounts[index] += 1;
    }
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
    const frame = getCameraFrame(camera);
    const view = lookAt(frame.eye, camera.target);
    const projection = perspective(
        Math.PI / 4,
        canvas.width / canvas.height,
        0.1,
        100,
    );
    const uniforms = new Float32Array(56);
    uniforms.set(multiplyMatrices(projection, view));
    if (renderMode === "triangles") {
        const features = shaderFeatures.triangles;
        uniforms[16] = proceduralPatternEnabled ? 1 : 0;
        uniforms[17] = features.lighting ? 1 : 0;
        uniforms[18] = features.frame ? 1 : 0;
        uniforms[19] = features.slots ? 1 : 0;
        uniforms[20] = features.edgeSmoothing ? 1 : 0;
        uniforms[21] = features.fakeDepth ? 1 : 0;
    } else if (renderMode === "utility") {
        uniforms.set([...frame.eye, 1], 16);
        uniforms.set([...frame.forward, 0], 20);
        uniforms.set([...frame.right, 0], 24);
        uniforms.set([...frame.up, 0], 28);
        uniforms.set([canvas.width, canvas.height, canvas.width / canvas.height, 0], 32);
        uniforms.set([0, 0, 1, 1], 36);
        uniforms.set([0, 0, 0, 1], 40);
        uniforms.set([0, 0, 0, 0], 44);
        uniforms.set([0, 0, 0, 0], 48);
        const arcPower = utilityArcEnabled
            ? utilityArcBrightness * utilityArcFlashIntensity(utilityTime)
            : 0;
        uniforms.set([utilityTime, arcPower, utilityArcEnabled ? 1 : 0, 0], 52);
    } else {
        const features = shaderFeatures.raymarch;
        uniforms.set([...frame.eye, 1], 16);
        uniforms.set([...frame.forward, 0], 20);
        uniforms.set([...frame.right, features.hatchClutter ? 1 : 0], 24);
        uniforms.set([...frame.up, features.overheadShadows ? 1 : 0], 28);
        uniforms.set([
            canvas.width,
            canvas.height,
            canvas.width / canvas.height,
            features.rayDebug ? 1 : 0,
        ], 32);
        uniforms.set([
            features.cutouts ? 1 : 0,
            features.frame ? 1 : 0,
            features.slats ? 1 : 0,
            features.lighting ? 1 : 0,
        ], 36);
        uniforms.set([
            features.softShadows ? 1 : 0,
            features.ambientOcclusion ? 1 : 0,
            features.marching ? 1 : 0,
            features.normals ? 1 : 0,
        ], 40);
        uniforms[44] = lightSize;
        uniforms[45] = features.directionalLight ? 1 : 0;
        uniforms[46] = features.overheadLight ? 1 : 0;
        uniforms[47] = greebleCount;
        uniforms.set([
            features.flushHatch ? 1 : 0,
            features.recessedHatch ? 1 : 0,
            features.controlPanel ? 1 : 0,
            features.overheadFixture ? 1 : 0,
        ], 48);
        uniforms.set([
            features.lightEmission ? 1 : 0,
            features.localLight ? 1 : 0,
            Math.sin(lightPhase) * 0.32,
            overheadIntensity * (features.lightFlicker ? lightFlickerBrightness(flickerTime) : 1),
        ], 52);
    }
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);
}

function resizeCanvas() {
    if (!device || !canvas || !context) {
        return;
    }

    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2) * renderScale;
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

function isFlickering() {
    const features = shaderFeatures.raymarch;
    return features.lightFlicker && features.overheadLight && overheadIntensity > 0 &&
        (features.lightEmission || (features.localLight && features.lighting));
}

export function lightFlickerBrightness(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        throw new RangeError("Flicker time must be finite and nonnegative.");
    }
    const hash = (index) => {
        const value = Math.sin(index * 127.1 + 31.7) * 43758.5453;
        return value - Math.floor(value);
    };
    const noise = (time) => {
        const index = Math.floor(time);
        const fraction = time - index;
        const blend = fraction * fraction * (3 - 2 * fraction);
        return hash(index) * (1 - blend) + hash(index + 1) * blend;
    };
    return 0.7 + 0.3 * (0.75 * noise(seconds * 0.8) + 0.25 * noise(seconds * 0.23 + 17));
}

function isLightAnimating() {
    return !benchmarkRunning && (renderMode === "utility" ||
        ((lightAnimationEnabled || isFlickering()) && renderMode !== "triangles" &&
        shaderFeatures.raymarch.overheadFixture)) &&
        (typeof document === "undefined" || !document.hidden);
}

export function utilityArcFlashIntensity(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        throw new RangeError("Arc time must be finite and nonnegative.");
    }
    const cyclePosition = seconds * 1.2;
    const cycle = Math.floor(cyclePosition);
    const phase = cyclePosition - cycle;
    const bursts = [
        [[0.035, 0.12]],
        [[0.075, 0.15], [0.205, 0.28]],
        [[0.025, 0.105]],
        [[0.12, 0.19], [0.245, 0.31], [0.36, 0.42]],
    ];
    return bursts[cycle % bursts.length].some(([start, end]) => phase >= start && phase < end) ? 1 : 0;
}

function resetAnimationTiming() {
    previousAnimationTimestamp = undefined;
    timingElapsed = 0;
    timingFrames = 0;
}

function animationVisibilityChanged() {
    resetAnimationTiming();
    timingCallback?.(isLightAnimating() ? "Measuring animation frame cadence..." :
        "Animation suspended; idle frames are not rendered.");
    if (isLightAnimating()) scheduleRender();
}

function drawFrame(timestamp) {
    animationFrame = 0;
    if (!device || !pipeline || !context || !depthTexture || renderFailed) {
        return;
    }

    try {
        const animating = isLightAnimating();
        if (animating && Number.isFinite(timestamp)) {
            if (previousAnimationTimestamp !== undefined) {
                const elapsed = Math.max(0, timestamp - previousAnimationTimestamp);
                if (lightAnimationEnabled) {
                    lightPhase = (lightPhase + elapsed * 0.001 * lightAnimationSpeed * Math.PI * 2) %
                        (Math.PI * 2);
                }
                if (isFlickering()) flickerTime += elapsed * 0.001;
                if (renderMode === "utility") utilityTime += elapsed * 0.001;
                timingElapsed += elapsed;
                timingFrames += 1;
                if (timingElapsed >= 1000) {
                    timingCallback?.(`${(timingFrames * 1000 / timingElapsed).toFixed(1)} frames/s · ${(timingElapsed / timingFrames).toFixed(1)} ms/frame interval (not GPU execution time)`);
                    timingElapsed = 0;
                    timingFrames = 0;
                }
            }
            previousAnimationTimestamp = timestamp;
        } else {
            resetAnimationTiming();
        }
        updateCameraUniform();
        const encoder = device.createCommandEncoder();
        if (renderMode === "reference") updateShadowMaps(encoder);
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
        pass.setPipeline(pipeline.main);
        pass.setBindGroup(0, bindGroup.main);
        if (renderMode === "triangles") {
            pass.setVertexBuffer(0, vertexBuffer);
            pass.draw(vertexCount);
        } else if (renderMode === "reference") {
            pass.setPipeline(pipeline.floor);
            pass.setBindGroup(0, bindGroup.floor);
            pass.setBindGroup(1, bindGroup.floorMaps);
            pass.draw(3);
            if (shaderFeatures.raymarch.marching && !shaderFeatures.raymarch.rayDebug) {
                pass.setPipeline(pipeline.main);
                pass.setBindGroup(0, bindGroup.main);
                pass.setBindGroup(1, bindGroup.maps);
                pass.setVertexBuffer(0, referenceResources.buffers[0]);
                pass.draw(referenceResources.counts[0]);
            }
        } else {
            pass.draw(3);
        }
        pass.end();
        device.queue.submit([encoder.finish()]);
        if (!firstFrameSubmitted) {
            firstFrameSubmitted = true;
            publishStatus(true, "WebGPU renderer ready.");
        }
        if (animating) scheduleRender();
    } catch (error) {
        renderFailed = true;
        publishStatus(false, `WebGPU rendering failed: ${messageFor(error)}. Retry graphics to preserve the current scene.`);
    }
}

function scheduleRender() {
    if (!benchmarkRunning && !animationFrame && !renderFailed) {
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

    if (!defaultShaderSources[renderMode]) {
        await loadDefaultShader(renderMode);
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
    pipelineFormat = format;
    const source = activeShaderSources[renderMode] || defaultShaderSources[renderMode];
    pipeline = await createPipeline(format, source, renderMode);
    createVertexBuffer();
    bindGroup = await createScopedBindGroup(pipeline);
    pipelines[renderMode] = pipeline;
    bindGroups[renderMode] = bindGroup;
    resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
    resizeCanvas();
    scheduleRender();

    return { ready: true, message: "WebGPU renderer ready." };
}

export async function start(canvasElement, sceneData, onStatus, onTiming) {
    cleanupResources();
    await shaderCompileTask;
    canvas = canvasElement;
    statusCallback = onStatus;
    timingCallback = onTiming;
    if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", animationVisibilityChanged);
    }
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

export function setProceduralPattern(enabled) {
    if (typeof enabled !== "boolean") {
        throw new RangeError("Procedural pattern setting must be a boolean.");
    }
    proceduralPatternEnabled = enabled;
    if (device && !renderFailed) {
        scheduleRender();
    }
}

export function getDefaultShaderSource() {
    return defaultShaderSources[renderMode] || "";
}

export function getShaderSource() {
    return activeShaderSources[renderMode] || "";
}

export function getRenderMode() {
    return renderMode;
}

export async function setRenderMode(mode, onStatus) {
    if (!Object.hasOwn(renderModes, mode)) {
        throw new RangeError(`Unknown renderer mode: ${mode}.`);
    }
    if (mode === renderMode) {
        return getShaderSource();
    }
    if (!device || renderFailed) {
        throw new Error("WebGPU is not ready. Retry graphics before switching renderer modes.");
    }

    clearTimeout(shaderUpdateTimer);
    shaderUpdateTimer = 0;
    const revision = ++shaderRevision;
    await shaderCompileTask;
    if (!device || renderFailed) {
        throw new Error("WebGPU is not ready. Retry graphics before switching renderer modes.");
    }

    if (!defaultShaderSources[mode]) {
        await loadDefaultShader(mode);
    }
    const source = activeShaderSources[mode] || defaultShaderSources[mode];
    const activeDevice = device;
    const modeLabel = mode === "raymarch" || mode === "utility" ? "ray-marched" :
        mode === "reference" ? "comparison" : "triangle";
    onStatus?.(`Compiling ${modeLabel} shader…`);

    try {
        let nextPipeline = pipelines[mode];
        let nextBindGroup = bindGroups[mode];
        if (!nextPipeline || !nextBindGroup) {
            nextPipeline = await createPipeline(pipelineFormat, source, mode);
            if (revision !== shaderRevision || device !== activeDevice) {
                return getShaderSource();
            }
            nextBindGroup = await createScopedBindGroup(nextPipeline);
            if (revision !== shaderRevision || device !== activeDevice) {
                return getShaderSource();
            }
            pipelines[mode] = nextPipeline;
            bindGroups[mode] = nextBindGroup;
        }

        renderMode = mode;
        animationVisibilityChanged();
        pipeline = nextPipeline;
        bindGroup = nextBindGroup;
        scheduleRender();
        const status = mode === "raymarch" ? "Ray-marched SDF vent wall active." :
            mode === "utility" ? "Ray-marched maintenance bay active; arc and panel lights are animating." :
            mode === "reference" ? "Matching triangles with cached shadow maps active." : "Triangle-mesh renderer active.";
        onStatus?.(status);
        return getShaderSource();
    } catch (error) {
        if (revision === shaderRevision && device === activeDevice) {
            onStatus?.(`Renderer mode not changed; the current mode remains active.\n${messageFor(error)}`);
        }
        throw error;
    }
}

export function getShaderFeatures() {
    return { ...shaderFeatures[renderMode] };
}

export function getComparisonSettings() {
    return {
        renderScale, shadowResolution, greebleCount,
        width: canvas?.width, height: canvas?.height,
        triangles: (referenceResources?.counts[0] ?? 0) / 3,
        shadowPassCounts: [...shadowPassCounts],
    };
}

export function setRenderScale(scale) {
    if (![0.5, 0.75, 1].includes(scale)) throw new RangeError("Render scale must be 0.5, 0.75, or 1.");
    renderScale = scale;
    resizeCanvas();
}

export function setGreebleCount(count) {
    greebleGrid(count);
    if (greebleCount === count) return;
    greebleCount = count;
    referenceGeometryDirty = true;
    if (device && !renderFailed) scheduleRender();
}

export function setShadowResolution(size) {
    if (![256, 512, 1024].includes(size)) throw new RangeError("Shadow resolution must be 256, 512, or 1024.");
    if (device && size > device.limits.maxTextureDimension2D) throw new RangeError("Shadow map exceeds device limits.");
    if (shadowResolution === size) return;
    shadowResolution = size;
    destroyReferenceResources();
    if (pipelines.reference) {
        bindGroups.reference = createBindGroup(pipelines.reference);
        if (renderMode === "reference") bindGroup = bindGroups.reference;
    }
    if (device && !renderFailed) scheduleRender();
}

export async function runComparison() {
    if (benchmarkRunning) throw new Error("A comparison is already running.");
    if (!device || renderFailed) throw new Error("WebGPU is not ready.");
    if (typeof document !== "undefined" && document.hidden) throw new Error("Keep the app visible while measuring.");
    for (const mode of ["raymarch", "reference"]) {
        if (activeShaderSources[mode] && activeShaderSources[mode] !== defaultShaderSources[mode]) {
            throw new Error("Reset the reference shaders to their files before a matched comparison.");
        }
    }
    const saved = { mode: renderMode, count: greebleCount, phase: lightPhase, flicker: flickerTime };
    const configuration = () => JSON.stringify({
        camera: scene.camera, features: shaderFeatures.raymarch,
        renderScale, shadowResolution, lightSize, overheadIntensity, lightAnimationEnabled, lightAnimationSpeed,
    });
    const savedConfiguration = configuration();
    const dimensions = [canvas.width, canvas.height];
    const activeDevice = device;
    const results = [];
    benchmarkRunning = true;
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    try {
        await activeDevice.queue.onSubmittedWorkDone();
        for (const count of [0, 32, 128]) {
            setGreebleCount(count);
            for (const mode of ["raymarch", "reference"]) {
                await setRenderMode(mode);
                const intervals = [];
                for (let sample = -3; sample < 12; sample += 1) {
                    if (device !== activeDevice || renderFailed) throw new Error("Graphics became unavailable during comparison.");
                    if (canvas.width !== dimensions[0] || canvas.height !== dimensions[1]) {
                        throw new Error("Viewport changed during comparison; run again at a fixed size.");
                    }
                    if (configuration() !== savedConfiguration) {
                        throw new Error("Camera or lighting settings changed during comparison; run again.");
                    }
                    if (document.hidden) throw new Error("Comparison interrupted by a hidden page.");
                    lightPhase = lightAnimationEnabled ? Math.max(0, sample) * 0.08 : saved.phase;
                    flickerTime = saved.flicker + (shaderFeatures.raymarch.lightFlicker ? Math.max(0, sample) * 0.05 : 0);
                    const begin = performance.now();
                    drawFrame();
                    await activeDevice.queue.onSubmittedWorkDone();
                    if (device !== activeDevice || renderFailed) throw new Error("Graphics failed during measurement.");
                    if (sample >= 0) intervals.push(performance.now() - begin);
                }
                intervals.sort((a, b) => a - b);
                results.push({
                    mode, greebles: count, width: dimensions[0], height: dimensions[1],
                    medianMs: (intervals[5] + intervals[6]) / 2,
                    triangles: mode === "reference" ? referenceResources.counts[0] / 3 : 0,
                });
            }
        }
        return results;
    } finally {
        greebleCount = saved.count;
        referenceGeometryDirty = true;
        lightPhase = saved.phase;
        flickerTime = saved.flicker;
        try {
            if (device === activeDevice && !renderFailed) await setRenderMode(saved.mode);
        } finally {
            benchmarkRunning = false;
            animationVisibilityChanged();
            if (device && !renderFailed) scheduleRender();
        }
    }
}

export function getLightSize() {
    return lightSize;
}

export function getOverheadIntensity() {
    return overheadIntensity;
}

export function setOverheadIntensity(intensity) {
    if (typeof intensity !== "number" || !Number.isFinite(intensity) || intensity < 0 || intensity > 4) {
        throw new RangeError("Overhead intensity must be a finite number between 0 and 4.");
    }
    overheadIntensity = intensity;
    animationVisibilityChanged();
    if (device && !renderFailed) scheduleRender();
}

export function getLightAnimation() {
    return { enabled: lightAnimationEnabled, speed: lightAnimationSpeed, offset: Math.sin(lightPhase) * 0.32 };
}

export function setLightAnimation(enabled) {
    if (typeof enabled !== "boolean") {
        throw new RangeError("Light animation setting must be a boolean.");
    }
    lightAnimationEnabled = enabled;
    resetAnimationTiming();
    timingCallback?.(isLightAnimating() ? "Measuring animation frame cadence..." :
        "Animation suspended; idle frames are not rendered.");
    if (device && !renderFailed) scheduleRender();
}

export function setLightAnimationSpeed(speed) {
    if (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0.05 || speed > 1) {
        throw new RangeError("Light animation speed must be between 0.05 and 1 cycles per second.");
    }
    lightAnimationSpeed = speed;
}

export function setUtilityArcEnabled(enabled) {
    if (typeof enabled !== "boolean") {
        throw new RangeError("Arc enabled setting must be a boolean.");
    }
    utilityArcEnabled = enabled;
    if (device && !renderFailed) scheduleRender();
}

export function setUtilityArcBrightness(brightness) {
    if (typeof brightness !== "number" || !Number.isFinite(brightness) || brightness < 0 || brightness > 12) {
        throw new RangeError("Arc brightness must be between 0 and 12.");
    }
    utilityArcBrightness = brightness;
    if (device && !renderFailed) scheduleRender();
}

export function setLightSize(size) {
    if (typeof size !== "number" || !Number.isFinite(size) || size < 0 || size > 1) {
        throw new RangeError("Light size must be a finite number between 0 and 1.");
    }
    lightSize = size;
    if (device && !renderFailed) {
        scheduleRender();
    }
}

export function setShaderFeature(name, enabled) {
    const features = shaderFeatures[renderMode];
    if (!features || !Object.hasOwn(features, name)) {
        throw new RangeError(`Unknown shader feature: ${name}.`);
    }
    if (typeof enabled !== "boolean") {
        throw new RangeError("Shader feature setting must be a boolean.");
    }

    features[name] = enabled;
    if (renderMode !== "triangles" &&
        ["overheadFixture", "overheadLight", "lightFlicker", "lightEmission", "localLight", "lighting"].includes(name)) {
        animationVisibilityChanged();
    }
    if (renderMode !== "triangles" &&
        ["cutouts", "frame", "slats", "flushHatch", "recessedHatch", "controlPanel", "overheadFixture", "hatchClutter"].includes(name)) {
        referenceGeometryDirty = true;
    }
    if (device && !renderFailed) {
        scheduleRender();
    }
}

export function updateShader(source, onStatus) {
    if (typeof source !== "string" || source.trim() === "") {
        onStatus?.("Shader source cannot be empty.");
        return;
    }
    if (!device || renderFailed) {
        onStatus?.("WebGPU is not ready. Retry graphics before compiling the shader.");
        return;
    }

    clearTimeout(shaderUpdateTimer);
    const revision = ++shaderRevision;
    shaderUpdateTimer = setTimeout(() => {
        shaderUpdateTimer = 0;
        const compile = async () => {
            if (revision !== shaderRevision || !device || renderFailed) {
                return;
            }
            const activeDevice = device;
            const mode = renderMode;
            onStatus?.("Compiling shader…");
            try {
                const nextPipeline = await createPipeline(pipelineFormat, source, mode);
                if (revision !== shaderRevision || device !== activeDevice || mode !== renderMode) {
                    return;
                }
                const nextBindGroup = await createScopedBindGroup(nextPipeline);
                if (revision !== shaderRevision || device !== activeDevice || mode !== renderMode) {
                    return;
                }
                pipeline = nextPipeline;
                bindGroup = nextBindGroup;
                pipelines[mode] = nextPipeline;
                bindGroups[mode] = nextBindGroup;
                activeShaderSources[mode] = source;
                if (mode === "reference") referenceResources.keys = [null, null];
                scheduleRender();
                onStatus?.("Shader compiled and applied.");
            } catch (error) {
                if (revision !== shaderRevision || device !== activeDevice) {
                    return;
                }
                onStatus?.(`Shader not applied; the last working shader remains active.\n${messageFor(error)}`);
            }
        };
        shaderCompileTask = shaderCompileTask.then(compile, compile);
    }, 350);
}

function cleanupResources() {
    if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", animationVisibilityChanged);
    }
    resetAnimationTiming();
    timingCallback = undefined;
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    clearTimeout(shaderUpdateTimer);
    shaderUpdateTimer = 0;
    shaderRevision += 1;
    if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
    }
    depthTexture?.destroy();
    depthTexture = undefined;
    destroyReferenceResources();
    shadowPassCounts = [0, 0];
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
    for (const mode of Object.keys(renderModes)) {
        delete pipelines[mode];
        delete bindGroups[mode];
    }
    statusCallback = undefined;
    canvas = undefined;
    scene = undefined;
    pipelineFormat = undefined;
    vertexCount = 0;
    vertexCapacity = 0;
    firstFrameSubmitted = false;
}

function destroyReferenceResources() {
    if (!referenceResources) return;
    referenceResources.maps.forEach((texture) => texture.destroy());
    referenceResources.buffers.forEach((buffer) => buffer.destroy());
    referenceResources.lightBuffers.forEach((buffer) => buffer.destroy());
    referenceResources.settings.destroy();
    referenceResources = undefined;
    referenceGeometryDirty = true;
}

export function stop() {
    cleanupResources();
}
