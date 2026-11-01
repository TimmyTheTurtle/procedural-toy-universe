export const GREEBLE_COUNTS = [0, 8, 32, 128];
export const REFERENCE_VERTEX_STRIDE = 8;

export function greebleGrid(count) {
    if (!GREEBLE_COUNTS.includes(count)) {
        throw new RangeError("Greebles per wall must be 0, 8, 32, or 128.");
    }
    const columns = count === 0 ? 0 : Math.sqrt(count * 2);
    return { columns, rows: columns / 2 };
}

function box(center, halfSize, material = 0, fixture = false) {
    return {
        min: center.map((value, axis) => value - halfSize[axis]),
        max: center.map((value, axis) => value + halfSize[axis]),
        material, fixture,
    };
}

function subtractBox(base, cutter) {
    const min = base.min.map((value, axis) => Math.max(value, cutter.min[axis]));
    const max = base.max.map((value, axis) => Math.min(value, cutter.max[axis]));
    if (min.some((value, axis) => value >= max[axis])) return [base];
    const pieces = [];
    const remainder = { ...base, min: [...base.min], max: [...base.max] };
    for (let axis = 0; axis < 3; axis += 1) {
        if (remainder.min[axis] < min[axis]) {
            const piece = { ...base, min: [...remainder.min], max: [...remainder.max] };
            piece.max[axis] = min[axis];
            pieces.push(piece);
        }
        if (remainder.max[axis] > max[axis]) {
            const piece = { ...base, min: [...remainder.min], max: [...remainder.max] };
            piece.min[axis] = max[axis];
            pieces.push(piece);
        }
        remainder.min[axis] = min[axis];
        remainder.max[axis] = max[axis];
    }
    return pieces;
}

export function createReferenceBoxes(features, count = 0) {
    const { columns, rows } = greebleGrid(count);
    const result = [];
    for (const recessed of [false, true]) {
        let body = [box([0, 1.2, 0], [1, 1.2, 0.07])];
        if (features.cutouts) {
            body = body.flatMap((part) => subtractBox(part, box([0, 1.75, 0], [0.455, 0.25, 0.2])));
        }
        const hatch = recessed ? features.recessedHatch : features.flushHatch;
        if (hatch) {
            body = body.flatMap((part) => subtractBox(part, box([0, 0.72, 0.07], [0.54, 0.47, 0.065])));
        }
        const parts = [...body];
        const add = (center, halfSize, material = 1, fixture = false) =>
            parts.push(box(center, halfSize, material, fixture));
        if (hatch) add([0, 0.72, recessed ? 0.02 : 0.0375], [0.52, 0.45, recessed ? 0.015 : 0.0325], 2);
        if (features.frame) {
            for (const x of [-0.475, 0.475]) add([x, 1.75, 0.09], [0.025, 0.3, 0.05]);
            for (const y of [1.475, 2.025]) add([0, y, 0.09], [0.475, 0.025, 0.05]);
        }
        if (features.slats) {
            for (let index = 0; index < 6; index += 1) add([0, 1.5 + index * 0.1, 0.09], [0.45, 0.018, 0.05]);
        }
        if (recessed && features.controlPanel) {
            add([0.77, 0.78, 0.087], [0.13, 0.22, 0.027]);
            add([0.77, 0.845, 0.115], [0.105, 0.12, 0.005], 3);
            for (let index = 0; index < 3; index += 1) add([0.7 + index * 0.07, 0.645, 0.118], [0.024, 0.025, 0.008], 4);
        }
        if (recessed && features.overheadFixture) {
            add([0, 1.29, 0.15], [0.56, 0.045, 0.1], 1, true);
            add([0, 1.24, 0.18], [0.48, 0.008, 0.055], 5, true);
        }
        if (recessed && features.hatchClutter) {
            add([0, 1.10, 0.17], [0.46, 0.028, 0.055], 6);
            for (const x of [-0.34, 0.30]) {
                add([x, 0.92, 0.185], [0.025, 0.18, 0.05], 6);
                add([x, 1.10, 0.17], [0.042, 0.045, 0.07], 6);
            }
            for (const x of [-0.43, 0.43]) add([x, 1.10, 0.095], [0.03, 0.06, 0.045]);
        }
        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                add([-0.88 + (column + 0.5) * 1.76 / columns, 2.08 + (row + 0.5) * 0.3 / rows, 0.09],
                    [1.76 / columns * 0.28, 0.3 / rows * 0.28, 0.03]);
            }
        }
        const offset = recessed ? 1.3 : -1.3;
        for (const part of parts) {
            part.min[0] += offset;
            part.max[0] += offset;
            result.push(part);
        }
    }
    return result;
}

// Split exposed box faces at intersections; omit union interiors and coplanar duplicates.
export function createReferenceVertices(features, count = 0) {
    const boxes = createReferenceBoxes(features, count);
    const vertices = [];
    const epsilon = 1e-7;
    for (const [index, part] of boxes.entries()) {
        for (let axis = 0; axis < 3; axis += 1) {
            const u = (axis + 1) % 3;
            const v = (axis + 2) % 3;
            for (const sign of [-1, 1]) {
                const plane = sign < 0 ? part.min[axis] : part.max[axis];
                const others = boxes.filter((other, otherIndex) =>
                    otherIndex !== index && other.fixture === part.fixture &&
                    other.min[axis] <= plane + epsilon && other.max[axis] >= plane - epsilon &&
                    other.min[u] < part.max[u] && other.max[u] > part.min[u] &&
                    other.min[v] < part.max[v] && other.max[v] > part.min[v]);
                const cuts = (coordinate) => [...new Set([
                    part.min[coordinate], part.max[coordinate],
                    ...others.flatMap((other) => [other.min[coordinate], other.max[coordinate]])
                        .filter((value) => value > part.min[coordinate] && value < part.max[coordinate]),
                ])].sort((a, b) => a - b);
                const us = cuts(u);
                const vs = cuts(v);
                for (let i = 0; i < us.length - 1; i += 1) {
                    for (let j = 0; j < vs.length - 1; j += 1) {
                        const midU = (us[i] + us[i + 1]) / 2;
                        const midV = (vs[j] + vs[j + 1]) / 2;
                        const covered = others.some((other) => {
                            if (midU <= other.min[u] || midU >= other.max[u] ||
                                midV <= other.min[v] || midV >= other.max[v]) return false;
                            const outside = plane + sign * epsilon;
                            if (outside > other.min[axis] && outside < other.max[axis]) return true;
                            const sameFace = Math.abs((sign < 0 ? other.min[axis] : other.max[axis]) - plane) < epsilon;
                            return sameFace && boxes.indexOf(other) < index;
                        });
                        if (covered) continue;
                        const corners = [[us[i], vs[j]], [us[i + 1], vs[j]],
                            [us[i + 1], vs[j + 1]], [us[i], vs[j + 1]]];
                        for (const corner of [0, 1, 2, 0, 2, 3]) {
                            const position = [0, 0, 0];
                            const normal = [0, 0, 0];
                            position[axis] = plane;
                            [position[u], position[v]] = corners[corner];
                            normal[axis] = sign;
                            vertices.push(...position, ...normal, part.material, part.fixture ? 1 : 0);
                        }
                    }
                }
            }
        }
    }
    return new Float32Array(vertices);
}
