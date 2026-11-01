export const WALL_DIMENSIONS = Object.freeze({
    length: 2,
    height: 2.4,
    thickness: 0.14,
});

export const GRID_SPACING_RANGE = Object.freeze({ min: 0.1, max: 5 });
export const ROTATION_STEP_RANGE = Object.freeze({ min: 1, max: 360 });

const GEOMETRY_TOLERANCE = 1e-8;

function requireFinite(value, name) {
    if (!Number.isFinite(value)) {
        throw new RangeError(`${name} must be a finite number.`);
    }
}

function requireRange(value, name, range) {
    requireFinite(value, name);
    if (value < range.min || value > range.max) {
        throw new RangeError(`${name} must be between ${range.min} and ${range.max}.`);
    }
}

function snap(value, increment) {
    const result = Math.round(value / increment) * increment;
    return result === 0 ? 0 : Number(result.toPrecision(14));
}

function normalizeAngle(degrees) {
    const remainder = degrees % 360;
    const result = remainder < 0 ? (remainder + 360) % 360 : remainder;
    return result === 0 ? 0 : result;
}

function exactTrig(value) {
    if (Math.abs(value) < GEOMETRY_TOLERANCE) {
        return 0;
    }
    if (Math.abs(Math.abs(value) - 1) < GEOMETRY_TOLERANCE) {
        return Math.sign(value);
    }
    return value;
}

export function wallAxes(wall) {
    const radians = wall.rotationDegrees * Math.PI / 180;
    const cosine = exactTrig(Math.cos(radians));
    const sine = exactTrig(Math.sin(radians));
    return {
        along: [cosine, -sine],
        across: [sine, cosine],
    };
}

export function wallEndpoints(wall) {
    const { along } = wallAxes(wall);
    const halfLength = wall.length / 2;
    return [
        [wall.x - along[0] * halfLength, wall.z - along[1] * halfLength],
        [wall.x + along[0] * halfLength, wall.z + along[1] * halfLength],
    ];
}

function dot2(left, right) {
    return left[0] * right[0] + left[1] * right[1];
}

function rectanglesOverlap(left, right) {
    const leftAxes = wallAxes(left);
    const rightAxes = wallAxes(right);
    const offset = [right.x - left.x, right.z - left.z];

    return [leftAxes.along, leftAxes.across, rightAxes.along, rightAxes.across]
        .every((axis) => {
            const leftRadius =
                left.length / 2 * Math.abs(dot2(leftAxes.along, axis)) +
                left.thickness / 2 * Math.abs(dot2(leftAxes.across, axis));
            const rightRadius =
                right.length / 2 * Math.abs(dot2(rightAxes.along, axis)) +
                right.thickness / 2 * Math.abs(dot2(rightAxes.across, axis));
            return Math.abs(dot2(offset, axis)) < leftRadius + rightRadius - GEOMETRY_TOLERANCE;
        });
}

function hasNormalEndJoin(left, right) {
    const leftEnds = wallEndpoints(left);
    const rightEnds = wallEndpoints(right);

    for (let leftIndex = 0; leftIndex < 2; leftIndex += 1) {
        for (let rightIndex = 0; rightIndex < 2; rightIndex += 1) {
            const leftEnd = leftEnds[leftIndex];
            const rightEnd = rightEnds[rightIndex];
            if (Math.hypot(leftEnd[0] - rightEnd[0], leftEnd[1] - rightEnd[1]) > GEOMETRY_TOLERANCE) {
                continue;
            }

            const leftOther = leftEnds[1 - leftIndex];
            const rightOther = rightEnds[1 - rightIndex];
            const leftDirection = [
                (leftOther[0] - leftEnd[0]) / left.length,
                (leftOther[1] - leftEnd[1]) / left.length,
            ];
            const rightDirection = [
                (rightOther[0] - rightEnd[0]) / right.length,
                (rightOther[1] - rightEnd[1]) / right.length,
            ];
            return dot2(leftDirection, rightDirection) < 1 - GEOMETRY_TOLERANCE;
        }
    }

    return false;
}

export function wallsOverlap(left, right) {
    return rectanglesOverlap(left, right) && !hasNormalEndJoin(left, right);
}

export function findOverlaps(walls) {
    const overlaps = [];
    for (let first = 0; first < walls.length; first += 1) {
        for (let second = first + 1; second < walls.length; second += 1) {
            if (wallsOverlap(walls[first], walls[second])) {
                overlaps.push([walls[first].id, walls[second].id]);
            }
        }
    }
    return overlaps;
}

export function pickWall(walls, ray) {
    if (!ray) {
        return null;
    }

    let nearestId = null;
    let nearestDistance = Infinity;
    for (const wall of walls) {
        const { along, across } = wallAxes(wall);
        const offset = [ray.origin[0] - wall.x, ray.origin[2] - wall.z];
        const direction = [ray.direction[0], ray.direction[2]];
        const localOrigin = [dot2(offset, along), ray.origin[1], dot2(offset, across)];
        const localDirection = [dot2(direction, along), ray.direction[1], dot2(direction, across)];
        const minimum = [-wall.length / 2, 0, -wall.thickness / 2];
        const maximum = [wall.length / 2, wall.height, wall.thickness / 2];
        let entry = 0;
        let exit = Infinity;

        for (let axis = 0; axis < 3; axis += 1) {
            if (Math.abs(localDirection[axis]) < GEOMETRY_TOLERANCE) {
                if (localOrigin[axis] < minimum[axis] || localOrigin[axis] > maximum[axis]) {
                    exit = -1;
                    break;
                }
                continue;
            }
            const first = (minimum[axis] - localOrigin[axis]) / localDirection[axis];
            const second = (maximum[axis] - localOrigin[axis]) / localDirection[axis];
            entry = Math.max(entry, Math.min(first, second));
            exit = Math.min(exit, Math.max(first, second));
        }

        if (exit >= entry && entry < nearestDistance) {
            nearestId = wall.id;
            nearestDistance = entry;
        }
    }

    return nearestId;
}

export class ConstructionModel {
    #walls = [];
    #selectedId = null;
    #nextId = 1;
    #undo = [];
    #redo = [];

    constructor() {
        this.snapEnabled = true;
        this.gridVisible = true;
        this.gridSpacing = 0.5;
        this.rotationStep = 90;
    }

    get walls() {
        return this.#walls.map((wall) => ({ ...wall }));
    }

    get selectedId() {
        return this.#selectedId;
    }

    get selectedWall() {
        const wall = this.#walls.find((item) => item.id === this.#selectedId);
        return wall ? { ...wall } : null;
    }

    get canUndo() {
        return this.#undo.length > 0;
    }

    get canRedo() {
        return this.#redo.length > 0;
    }

    setSnapEnabled(enabled) {
        if (typeof enabled !== "boolean") {
            throw new TypeError("Snap setting must be on or off.");
        }
        this.snapEnabled = enabled;
    }

    setGridVisible(visible) {
        if (typeof visible !== "boolean") {
            throw new TypeError("Grid visibility must be on or off.");
        }
        this.gridVisible = visible;
    }

    setGridSpacing(spacing) {
        requireRange(spacing, "Grid spacing", GRID_SPACING_RANGE);
        this.gridSpacing = spacing;
    }

    setRotationStep(degrees) {
        requireRange(degrees, "Rotation increment", ROTATION_STEP_RANGE);
        this.rotationStep = degrees;
    }

    positionAt(x, z) {
        requireFinite(x, "X position");
        requireFinite(z, "Z position");
        return this.snapEnabled
            ? { x: snap(x, this.gridSpacing), z: snap(z, this.gridSpacing) }
            : { x, z };
    }

    rotationAt(degrees) {
        requireFinite(degrees, "Rotation");
        return normalizeAngle(this.snapEnabled ? snap(degrees, this.rotationStep) : degrees);
    }

    select(id) {
        if (id !== null && !this.#walls.some((wall) => wall.id === id)) {
            throw new RangeError(`Wall ${id} does not exist.`);
        }
        this.#selectedId = id;
    }

    addWall(x, z, rotationDegrees = 0) {
        const position = this.positionAt(x, z);
        const rotation = this.rotationAt(rotationDegrees);
        this.#saveUndo();
        const wall = {
            id: `wall-${this.#nextId}`,
            ...WALL_DIMENSIONS,
            ...position,
            rotationDegrees: rotation,
        };
        this.#nextId += 1;
        this.#walls.push(wall);
        this.#selectedId = wall.id;
        return { ...wall };
    }

    moveWall(id, x, z) {
        const wall = this.#requireWall(id);
        const position = this.positionAt(x, z);
        if (wall.x === position.x && wall.z === position.z) {
            return false;
        }
        this.#saveUndo();
        Object.assign(wall, position);
        this.#selectedId = id;
        return true;
    }

    rotateWall(id, degrees) {
        const wall = this.#requireWall(id);
        const rotation = this.rotationAt(degrees);
        if (wall.rotationDegrees === rotation) {
            return false;
        }
        this.#saveUndo();
        wall.rotationDegrees = rotation;
        this.#selectedId = id;
        return true;
    }

    deleteWall(id) {
        this.#requireWall(id);
        this.#saveUndo();
        this.#walls = this.#walls.filter((wall) => wall.id !== id);
        if (this.#selectedId === id) {
            this.#selectedId = null;
        }
    }

    undo() {
        if (!this.canUndo) {
            return false;
        }
        this.#redo.push(this.#snapshot());
        this.#restore(this.#undo.pop());
        return true;
    }

    redo() {
        if (!this.canRedo) {
            return false;
        }
        this.#undo.push(this.#snapshot());
        this.#restore(this.#redo.pop());
        return true;
    }

    #requireWall(id) {
        const wall = this.#walls.find((item) => item.id === id);
        if (!wall) {
            throw new RangeError(`Wall ${id} does not exist.`);
        }
        return wall;
    }

    #snapshot() {
        return { walls: this.walls, selectedId: this.#selectedId };
    }

    #restore(snapshot) {
        this.#walls = snapshot.walls.map((wall) => ({ ...wall }));
        this.#selectedId = snapshot.selectedId;
    }

    #saveUndo() {
        this.#undo.push(this.#snapshot());
        this.#redo = [];
    }
}
