import {
    ConstructionModel,
    findOverlaps,
    pickWall,
    WALL_DIMENSIONS,
} from "./construction-model.js";
import {
    createCamera,
    createGridBoxes,
    getGroundOrbitPivot,
    getPointerRay,
    intersectConstructionPlane,
    orbitCameraAroundGroundPoint,
    panCameraOnConstructionPlane,
} from "./scene-model.js";
import * as webgpu from "./webgpu-renderer.js";

const DRAG_THRESHOLD = 5;
const CLICK_DELAY_MS = 500;

function wallBox(wall, selected, preview) {
    return {
        id: preview ? "preview" : wall.id,
        center: [wall.x, wall.height / 2, wall.z],
        size: [wall.length, wall.height, wall.thickness],
        rotationDegrees: wall.rotationDegrees,
        color: preview ? [0.87, 0.73, 0.32] : selected ? [0.24, 0.58, 0.83] : [0.58, 0.66, 0.73],
    };
}

function numberFromInput(value, name) {
    if ((typeof value !== "string" && typeof value !== "number") ||
        (typeof value === "string" && value.trim() === "")) {
        throw new RangeError(`${name} must be a number.`);
    }
    const number = Number(value);
    if (!Number.isFinite(number)) {
        throw new RangeError(`${name} must be a finite number.`);
    }
    return number;
}

export class WorkbenchController {
    constructor(canvas, onEditor, onRenderer, renderer = webgpu) {
        this.canvas = canvas;
        this.onEditor = onEditor;
        this.onRenderer = onRenderer;
        this.renderer = renderer;
        this.model = new ConstructionModel();
        this.camera = createCamera();
        this.ready = false;
        this.mode = "select";
        this.preview = null;
        this.previewRotation = 0;
        this.lastPointer = null;
        this.drag = null;
        this.pendingClicks = [];
        this.gridKey = "";
        this.gridBoxes = [];
        this.lastSnapshot = "";
        this.feedback = "Choose Place wall, or click a wall to select it.";
        this.handlers = {
            pointerdown: (event) => this.pointerDown(event),
            pointermove: (event) => this.pointerMove(event),
            pointerup: (event) => this.pointerUp(event),
            pointercancel: (event) => this.pointerCancel(event),
            pointerleave: () => this.pointerLeave(),
            wheel: (event) => this.wheel(event),
            dblclick: (event) => this.doubleClick(event),
            contextmenu: (event) => event.preventDefault(),
            keydown: (event) => this.keyDown(event),
        };
        for (const [name, handler] of Object.entries(this.handlers)) {
            if (name !== "keydown") {
                canvas.addEventListener(name, handler, name === "wheel" ? { passive: false } : undefined);
            }
        }
        window.addEventListener("keydown", this.handlers.keydown);
    }

    async start() {
        const result = await this.renderer.start(
            this.canvas,
            this.projectScene(),
            (status) => this.rendererStatus(status),
        );
        this.rendererStatus(result);
        return result;
    }

    rendererStatus(status) {
        this.ready = status.ready;
        this.onRenderer(status);
        this.publish();
    }

    dispose() {
        this.clearPendingClicks();
        for (const [name, handler] of Object.entries(this.handlers)) {
            if (name !== "keydown") {
                this.canvas.removeEventListener(name, handler);
            }
        }
        window.removeEventListener("keydown", this.handlers.keydown);
        this.renderer.stop();
    }

    updateGrid() {
        const spacing = this.model.gridSpacing;
        const centerX = Math.floor(this.camera.target[0] / spacing);
        const centerZ = Math.floor(this.camera.target[2] / spacing);
        const key = `${spacing}:${this.model.gridVisible}:${centerX}:${centerZ}`;
        if (key === this.gridKey) {
            return false;
        }
        this.gridBoxes = createGridBoxes(spacing, this.model.gridVisible, this.camera);
        this.gridKey = key;
        return true;
    }

    projectScene() {
        this.updateGrid();
        const walls = this.model.walls.map((wall) =>
            wallBox(wall, wall.id === this.model.selectedId, false));
        if (this.preview) {
            walls.push(wallBox(this.preview, false, true));
        }
        return { camera: this.camera, boxes: [...this.gridBoxes, ...walls] };
    }

    redraw() {
        if (this.ready) {
            this.renderer.updateScene(this.projectScene());
        }
        this.publish();
    }

    redrawCamera() {
        if (!this.ready) {
            return;
        }
        if (this.updateGrid()) {
            this.renderer.updateScene(this.projectScene());
        } else {
            this.renderer.render();
        }
    }

    warning() {
        const walls = this.model.walls;
        if (this.preview) {
            const others = this.mode === "move"
                ? walls.filter((wall) => wall.id !== this.model.selectedId)
                : walls;
            const previewConflict = findOverlaps([...others, this.preview])
                .find(([first, second]) => first === "preview" || second === "preview");
            if (previewConflict) {
                const other = previewConflict.find((id) => id !== "preview");
                return `Preview overlaps ${other}. Overlaps are allowed.`;
            }
        }
        const overlaps = findOverlaps(walls);
        if (overlaps.length > 0) {
            const [first, second] = overlaps[0];
            return `${first} overlaps ${second}. Overlaps are allowed.`;
        }
        return "";
    }

    snapshot() {
        return {
            ready: this.ready,
            mode: this.mode,
            wallCount: this.model.walls.length,
            selected: this.model.selectedWall,
            snapEnabled: this.model.snapEnabled,
            gridVisible: this.model.gridVisible,
            gridSpacing: this.model.gridSpacing,
            rotationStep: this.model.rotationStep,
            canUndo: this.model.canUndo,
            canRedo: this.model.canRedo,
            feedback: this.feedback,
            warning: this.warning(),
        };
    }

    publish() {
        const snapshot = this.snapshot();
        const serialized = JSON.stringify(snapshot);
        if (serialized !== this.lastSnapshot) {
            this.lastSnapshot = serialized;
            this.onEditor(snapshot);
        }
    }

    run(action, commitPending = true) {
        if (!this.ready) {
            this.feedback = "Graphics are unavailable. Retry graphics before editing.";
            this.publish();
            return;
        }
        try {
            if (commitPending) {
                this.commitPendingClicks();
            }
            action();
            this.redraw();
        } catch (error) {
            if (!(error instanceof RangeError) && !(error instanceof TypeError)) {
                throw error;
            }
            this.feedback = error.message;
            this.publish();
        }
    }

    beginPlacement() {
        this.run(() => {
            this.clearPendingClicks();
            this.mode = "place";
            this.previewRotation = 0;
            this.feedback = "Move over the plane and click to place a wall. Escape cancels.";
            this.updatePreview();
        });
    }

    beginMove() {
        this.run(() => {
            const wall = this.model.selectedWall;
            if (!wall) {
                throw new RangeError("Select a wall before moving it.");
            }
            this.clearPendingClicks();
            this.mode = "move";
            this.previewRotation = wall.rotationDegrees;
            this.feedback = "Move over the plane and click to move the selected wall. Escape cancels.";
            this.updatePreview();
        });
    }

    beginDuplicate() {
        this.run(() => {
            const wall = this.model.selectedWall;
            if (!wall) {
                throw new RangeError("Select a wall before duplicating it.");
            }
            this.clearPendingClicks();
            this.mode = "duplicate";
            this.previewRotation = wall.rotationDegrees;
            this.feedback = "Move over the plane and click to place a duplicate. Escape cancels.";
            this.updatePreview();
        });
    }

    cancel() {
        this.run(() => {
            this.clearPendingClicks();
            this.mode = "select";
            this.preview = null;
            this.feedback = "Placement cancelled.";
        }, false);
    }

    rotate(direction) {
        this.run(() => {
            if (direction !== -1 && direction !== 1) {
                throw new RangeError("Rotation direction must be left or right.");
            }
            if (this.mode === "place" || this.mode === "duplicate") {
                this.previewRotation = this.model.rotationAt(
                    this.previewRotation + direction * this.model.rotationStep,
                );
                this.updatePreview();
                return;
            }
            if (this.mode !== "select" || !this.model.selectedWall) {
                throw new RangeError("Select a wall before rotating it.");
            }
            const wall = this.model.selectedWall;
            this.model.rotateWall(wall.id, wall.rotationDegrees + direction * this.model.rotationStep);
            this.feedback = `${wall.id} rotated.`;
        });
    }

    setRotation(value) {
        this.run(() => {
            if (this.mode !== "select" || !this.model.selectedWall) {
                throw new RangeError("Select a wall before changing its rotation.");
            }
            const wall = this.model.selectedWall;
            this.model.rotateWall(wall.id, numberFromInput(value, "Rotation"));
            this.feedback = `${wall.id} rotation updated.`;
        });
    }

    deleteSelected() {
        this.run(() => {
            const wall = this.model.selectedWall;
            if (this.mode !== "select" || !wall) {
                throw new RangeError("Select a wall before deleting it.");
            }
            this.model.deleteWall(wall.id);
            this.feedback = `${wall.id} deleted.`;
        });
    }

    undo() {
        this.run(() => {
            this.clearPendingClicks();
            this.mode = "select";
            this.preview = null;
            this.feedback = this.model.undo() ? "Edit undone." : "Nothing to undo.";
        });
    }

    redo() {
        this.run(() => {
            this.clearPendingClicks();
            this.mode = "select";
            this.preview = null;
            this.feedback = this.model.redo() ? "Edit redone." : "Nothing to redo.";
        });
    }

    setSnap(enabled) {
        this.run(() => {
            this.model.setSnapEnabled(enabled);
            this.feedback = enabled ? "Snapping enabled." : "Free placement and rotation enabled.";
            this.updatePreview();
        });
    }

    setGridVisible(visible) {
        this.run(() => {
            this.model.setGridVisible(visible);
            this.feedback = visible ? "Grid visible." : "Grid hidden; snapping is unchanged.";
        });
    }

    setGridSpacing(value) {
        this.run(() => {
            this.model.setGridSpacing(numberFromInput(value, "Grid spacing"));
            this.feedback = "Grid spacing updated.";
            this.updatePreview();
        });
    }

    setRotationStep(value) {
        this.run(() => {
            this.model.setRotationStep(numberFromInput(value, "Rotation increment"));
            this.feedback = "Rotation increment updated.";
            this.updatePreview();
        });
    }

    updatePreview() {
        if (this.mode === "select" || !this.lastPointer) {
            this.preview = null;
            return;
        }
        const ray = getPointerRay(
            this.camera,
            this.canvas.getBoundingClientRect(),
            this.lastPointer.x,
            this.lastPointer.y,
        );
        const point = intersectConstructionPlane(ray);
        if (!point) {
            this.preview = null;
            return;
        }
        const position = this.model.positionAt(point[0], point[2]);
        const source = this.mode === "move" || this.mode === "duplicate"
            ? this.model.selectedWall
            : null;
        this.preview = {
            id: "preview",
            ...WALL_DIMENSIONS,
            ...position,
            rotationDegrees: source && this.mode === "move"
                ? source.rotationDegrees
                : this.model.rotationAt(this.previewRotation),
        };
    }

    click(x, y) {
        this.run(() => {
            const ray = getPointerRay(this.camera, this.canvas.getBoundingClientRect(), x, y);
            if (this.mode === "select") {
                const id = pickWall(this.model.walls, ray);
                this.model.select(id);
                this.feedback = id ? `${id} selected.` : "No wall selected.";
                return;
            }

            this.lastPointer = { x, y };
            this.updatePreview();
            if (!this.preview) {
                throw new RangeError("Point at the construction plane before placing a wall.");
            }
            if (this.mode === "move") {
                const id = this.model.selectedId;
                this.model.moveWall(id, this.preview.x, this.preview.z);
                this.feedback = `${id} moved.`;
            } else {
                const wall = this.model.addWall(this.preview.x, this.preview.z, this.preview.rotationDegrees);
                this.feedback = `${wall.id} added.`;
            }
            this.mode = "select";
            this.preview = null;
        }, false);
    }

    pointerDown(event) {
        if (!this.ready || (event.button !== 0 && event.button !== 2)) {
            return;
        }
        this.canvas.focus({ preventScroll: true });
        this.canvas.setPointerCapture(event.pointerId);
        const pan = event.button === 2 || event.shiftKey;
        this.drag = {
            pointerId: event.pointerId,
            button: event.button,
            pan,
            startX: event.clientX,
            startY: event.clientY,
            x: event.clientX,
            y: event.clientY,
            moved: false,
            orbitPivot: pan ? undefined : getGroundOrbitPivot(
                this.camera, this.canvas.getBoundingClientRect(), event.clientX, event.clientY,
            ),
        };
    }

    pointerMove(event) {
        if (!this.ready) {
            return;
        }
        this.lastPointer = { x: event.clientX, y: event.clientY };
        if (this.drag && this.drag.pointerId === event.pointerId) {
            const distance = Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY);
            if (!this.drag.moved && distance < DRAG_THRESHOLD) {
                return;
            }
            if (!this.drag.moved) {
                this.commitPendingClicks();
            }
            this.drag.moved = true;
            const deltaX = event.clientX - this.drag.x;
            const deltaY = event.clientY - this.drag.y;
            this.drag.x = event.clientX;
            this.drag.y = event.clientY;
            if (this.drag.pan) {
                panCameraOnConstructionPlane(this.camera, deltaX, deltaY, this.camera.distance * 0.002);
            } else {
                this.camera.yaw -= deltaX * 0.008;
                this.camera.pitch = Math.max(-1.2, Math.min(1.2, this.camera.pitch + deltaY * 0.008));
                if (this.drag.orbitPivot) {
                    const bounds = this.canvas.getBoundingClientRect();
                    orbitCameraAroundGroundPoint(this.camera, this.drag.orbitPivot, bounds.width / bounds.height);
                }
            }
            if (this.mode !== "select") {
                this.updatePreview();
                this.redraw();
            } else {
                this.redrawCamera();
            }
            return;
        }
        if (this.mode !== "select") {
            this.updatePreview();
            this.redraw();
        }
    }

    pointerUp(event) {
        if (!this.drag || this.drag.pointerId !== event.pointerId) {
            return;
        }
        const drag = this.drag;
        this.drag = null;
        if (this.canvas.hasPointerCapture(event.pointerId)) {
            this.canvas.releasePointerCapture(event.pointerId);
        }
        if (!drag.moved && drag.button === 0) {
            const click = { x: event.clientX, y: event.clientY, edit: !drag.pan };
            click.timer = setTimeout(() => {
                const index = this.pendingClicks.indexOf(click);
                if (index !== -1) {
                    this.pendingClicks.splice(index, 1);
                    if (click.edit) {
                        this.click(click.x, click.y);
                    }
                }
            }, CLICK_DELAY_MS);
            this.pendingClicks.push(click);
        }
    }

    pointerCancel(event) {
        if (this.drag?.pointerId === event.pointerId) {
            this.drag = null;
        }
    }

    pointerLeave() {
        if (!this.drag && this.mode !== "select" && this.preview) {
            this.lastPointer = null;
            this.preview = null;
            this.redraw();
        }
    }

    wheel(event) {
        if (!this.ready) {
            return;
        }
        event.preventDefault();
        this.commitPendingClicks();
        this.camera.distance = Math.max(
            this.camera.minDistance,
            Math.min(this.camera.maxDistance, this.camera.distance * (1 + event.deltaY * 0.001)),
        );
        if (this.mode !== "select") {
            this.updatePreview();
            this.redraw();
        } else {
            this.redrawCamera();
        }
    }

    doubleClick(event) {
        if (!this.ready) {
            return;
        }
        event.preventDefault();
        // The last two pending clicks belong to the double-click.
        for (let index = 0; index < 2; index += 1) {
            const click = this.pendingClicks.pop();
            if (click) {
                clearTimeout(click.timer);
            }
        }
        this.commitPendingClicks();
        Object.assign(this.camera, createCamera());
        this.lastPointer = { x: event.clientX, y: event.clientY };
        this.updatePreview();
        this.feedback = "Camera reset.";
        this.redraw();
    }

    keyDown(event) {
        if (event.key === "Escape" && this.mode !== "select") {
            event.preventDefault();
            this.cancel();
        }
    }

    clearPendingClicks() {
        for (const click of this.pendingClicks) {
            clearTimeout(click.timer);
        }
        this.pendingClicks = [];
    }

    commitPendingClicks() {
        const clicks = this.pendingClicks;
        this.pendingClicks = [];
        for (const click of clicks) {
            clearTimeout(click.timer);
            if (click.edit) {
                this.click(click.x, click.y);
            }
        }
    }
}

let controller;

function notify(dotNetReference, method, value) {
    dotNetReference.invokeMethodAsync(method, value).catch((error) => {
        console.error(`Could not update ${method} in the UI.`, error);
    });
}

function requireController() {
    if (!controller) {
        throw new Error("The construction workbench has not started.");
    }
    return controller;
}

export async function start(canvas, dotNetReference) {
    controller?.dispose();
    controller = new WorkbenchController(
        canvas,
        (state) => notify(dotNetReference, "OnEditorStateChanged", state),
        (status) => notify(dotNetReference, "OnRendererStatusChanged", status),
    );
    return controller.start();
}

export async function retryRenderer() { return requireController().start(); }
export function beginPlacement() { requireController().beginPlacement(); }
export function beginMove() { requireController().beginMove(); }
export function beginDuplicate() { requireController().beginDuplicate(); }
export function cancel() { requireController().cancel(); }
export function rotate(direction) { requireController().rotate(direction); }
export function setRotation(value) { requireController().setRotation(value); }
export function deleteSelected() { requireController().deleteSelected(); }
export function undo() { requireController().undo(); }
export function redo() { requireController().redo(); }
export function setSnap(enabled) { requireController().setSnap(enabled); }
export function setGridVisible(visible) { requireController().setGridVisible(visible); }
export function setGridSpacing(value) { requireController().setGridSpacing(value); }
export function setRotationStep(value) { requireController().setRotationStep(value); }

export function stop() {
    controller?.dispose();
    controller = undefined;
}
