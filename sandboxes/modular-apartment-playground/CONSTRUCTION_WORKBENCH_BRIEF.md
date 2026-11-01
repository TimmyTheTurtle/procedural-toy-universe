# Construction Workbench — Agent Implementation Brief

**Status:** Stages 0.5 and 1 are authorized. Later stages remain planned and require separate authorization.

**Target:** `sandboxes/modular-apartment-playground/` in `TimmyTheTurtle/procedural-toy-universe`

**Technology retained:** Blazor WebAssembly, .NET 10, Fluent UI Blazor, browser-native WebGPU.

**Explicitly deferred:** WebGL2 compatibility rendering unless testing identifies a real need, native Direct3D 12, a general-purpose renderer-agnostic cross-program API, broader semantic-construction system, procedural generation in the initial slice.

> **Instruction for the next coding agent:** Read this entire document, the existing sandbox source, `AGENTS.md`, and repository build/deployment workflows before editing. The owner has authorized the Stage 0.5 rendering foundation and Stage 1 editable-construction work. Do not treat this brief as permission to implement later stages. Keep work on a feature branch and offer a pull request when appropriate; do not overwrite `main` directly.

## 1. Intended experience

An exploratory, Planet Coaster-inspired **single-building-plane 3D construction editor**. The user can see a grid, place wall pieces, select/move/rotate/duplicate/delete them, arrange an enclosed room, and see floor and ceiling surfaces created automatically. They can then place ceiling lights freely within the ceiling footprint, choosing point or spotlight types, and inspect the space with high-quality lighting and shadows.

The sandbox is a tool for **semantic-construction-grammar research**. Stages 1 through 5 are the research progression: each stage explores construction and increasingly expressive rules, components, patterns, or generation through a small working system. Stage 0.5 provides a WebGPU rendering foundation for that work; it is not a separate research topic. Keep construction state independent of the renderer so another backend can be introduced if testing demonstrates a compatibility need. **Do not** start by building the ultimate procedural world engine. This is a workbench, not a contractual architecture baseline.

### A simple demonstration

1. Open app; see an empty 3D building plane with visible grid, orbitable camera, and wall tool.
2. Place four wall segments forming a rectangle using grid snapping.
3. Select a wall, move it, rotate it, duplicate it, undo/redo edits; geometry remains editable.
4. Close the boundary; floor and ceiling appear automatically. Open the boundary; generated surfaces update or disappear predictably.
5. Choose a point light; click a non-grid-aligned position on the ceiling. Change its parameters and move it.
6. Choose a spotlight; aim it downward or adjust orientation/cone, observe shadows cast by walls.
7. Save and reload the scene without losing the user's placements.

## 2. Nonnegotiable scope decisions

- **Reuse the existing sandbox directory** and preserve its Blazor WebAssembly / .NET 10 / Fluent UI / WebGPU stack. Do not add a WebGL2 renderer unless testing demonstrates a compatibility need.
- **Replace the obsolete rotating-room demo** and discard irrelevant demo implementation and stale instructions; keep working build/deployment infrastructure where applicable.
- **One construction plane** means wall bases at a common elevation (e.g. y=0), not a 2D visual presentation. Walls have height and thickness; camera is 3D.
- **Walls are the only manually placed structural piece initially.** Floor and ceiling are generated from wall enclosure; they are not separate palette tools.
- **Wall maneuverability** should feel like Planet Coaster's construction editing: select, translate on plane, rotate about vertical axis, grid snap on/off, duplicate, delete, cancel, and undo/redo. Do not claim literal parity with every Planet Coaster tool or shortcut.
- **Lights** are ceiling-mounted but **not grid-attached**; their XY/XZ position (depending on coordinate convention) is continuous within a valid ceiling region. Support point and spotlight definitions.
- **Lighting quality matters:** proper occlusion and shadows, sensible PBR material response, physically interpretable light parameters. Distinguish shadow mapping, software/compute ray techniques, and hardware ray tracing; **WebGPU does not expose a standard hardware ray-tracing pipeline**. Do not promise hardware DXR or full path tracing in WebGPU. Establish feasible quality/performance and document tradeoffs. If the owner insists on ray-traced/path-traced shadows, present feasible approaches before substituting shadow maps.
- **Direct3D 12 is explicitly deferred.** Do not create a DX12 host, a native Windows project, or a general-purpose renderer SDK. A narrow sandbox-local rendering boundary is in scope; WebGL2 remains deferred unless testing demonstrates a compatibility need.
- **No requirements graph, WFC, semantic generation, CSG, imported asset conversion, or large component catalog in the first vertical slice.** Those are later research directions.

## 3. Implementation stages (sequence, not rigid milestones)

### Stage 0 — Inspect, reset, and clean

- Read all sandbox files and relevant project documentation; build the current app before replacing it if feasible.
- Identify existing reusable bootstrap, WebGPU initialization, shaders, UI shell, CI and Pages deployment workflows.
- Inventory what will be removed/retained and identify dangling references. Avoid deleting workflows just because the demo is replaced.
- Preserve useful history in Git and supersede prior decisions rather than erasing the decision log.
- Produce a concise implementation plan, note hardware/browser prerequisites, and validate with the owner if an ambiguous choice materially changes UX.

### Stage 0.5 — WebGPU rendering foundation

Provide a small WebGPU rendering foundation for construction research. The current test confirmed that WebGPU works when the app is opened in a secure context; the earlier failure was caused by using plain HTTP at a LAN address. This is not a graphics benchmark and does not require a complete editor. Defer a compatibility renderer until testing identifies a browser or device that needs one.

**Required behavior**
- Provide one WebGPU renderer for the same small construction example, using simple 3D geometry and basic camera controls. The example may be fixed; wall editing is not required in this stage.
- Keep construction state and experiment rules independent of the renderer. The renderer consumes shared scene and camera information; GPU resources and shaders are implementation details.
- Attempt actual WebGPU initialization, not just API presence. Show whether the page is an insecure context, WebGPU is unsupported, or initialization failed, and give an actionable message for each failure.
- Use only a narrow sandbox-local boundary for initialization, scene updates and rendering, resizing, and disposal. Do not build a general-purpose renderer framework.
- Future experiments may require capabilities unavailable on some devices. Identify those requirements and report unsupported features explicitly rather than claiming support or blocking all semantic research on advanced graphics. Reconsider WebGL2 only when a concrete compatibility need is observed.

**Validation scenarios**
- On a supported browser opened from a secure context, verify actual WebGPU initialization and that the example renders.
- Verify that an insecure context, unsupported WebGPU API, and initialization failure each produce a clear diagnostic instead of a success-shaped fallback.
- Verify that scene/construction state remains independent of WebGPU resources and renderer lifecycle.
- Validate in real browsers where available. Record unverified scenarios; simulated failures do not replace runtime checks.

### Stage 1 — Editable grid and walls

Research starting point: explore editable construction, spatial placement, and optional snapping through a small set of independently manipulable wall pieces.

**Required behavior**
- Render a clearly visible construction plane with configurable/visible grid and a 3D orbit/pan/zoom camera.
- Provide one simple wall type (rectangular prism) with explicit length, height, thickness, local origin/pivot and stable instance ID.
- Place a wall using mouse/pointer ray-plane intersection; provide ghost preview and cancel.
- Select by picking, translate along the construction plane, rotate around vertical axis, duplicate, delete, and undo/redo.
- Support snap-on/snap-off; at least configurable grid spacing and rotation increments, with free placement/rotation mode where practical.
- Walls must remain independently editable; no flattening into a single baked room mesh.
- Provide basic feedback for invalid/ambiguous operations. For manual editing in this stage, allow crossing or overlapping walls and show a warning; ordinary end-to-end joins are not treated as overlaps. Near-touching ends are not automatically joined. This does not relax collision validation for later generated geometry.

**Validation scenarios**
- Four equal walls form a rectangle with exact shared endpoints after snapping.
- Rotating and translating one wall changes its world transform without altering other wall definitions.
- Toggle snap off and place a wall between grid lines; toggle on and resume snapped placement.
- Undo/redo restores wall addition, deletion, and transformation deterministically.
- Camera movement does not accidentally select/drag walls.

### Stage 2 — Automatic floor/ceiling

Explore how constructed boundaries imply spaces and how derived geometry responds to changes in the underlying construction.

**Required behavior**
- Detect closed boundaries from placed walls and generate horizontal floor and ceiling surfaces at consistent heights.
- Initial minimum: a simple rectangular four-wall loop; expand to irregular polygon loops as a separate experiment.
- Represent wall junctions/topology robustly, using explicit endpoints and tolerance/quantization policy rather than relying on pixels appearing to touch.
- Generated surfaces are derived, never authoritative; moving/removing a wall updates or invalidates enclosure.
- Generated ceiling must support arbitrary valid light placement; define behavior if the ceiling disappears.
- Explicitly document whether ceiling occludes editor camera and offer a practical hide/transparent/cutaway view.

**Validation scenarios**
- Closing a four-wall rectangle creates exactly one floor and ceiling.
- Removing a wall removes/updates the enclosure; no stale invisible collider or ceiling remains.
- Shared walls and multiple adjacent enclosures are documented as deferred until implemented, not silently treated as working.

### Stage 3 — Ceiling lighting and shadows

Explore how added systems relate to constructed spaces and surfaces. Renderer-specific lighting limits are part of the experiment and must be made visible.

**Required behavior**
- Add light placement tool with point and spot modes.
- Lights mount to the derived ceiling surface and are freely positioned within it, independent of the construction grid.
- Editable intensity, color, position, and spot cone/orientation; choose defaults that visibly illuminate a modest room.
- Shadows respond to wall geometry and light position; physically plausible material shading and tone mapping.
- Provide an editor viewing mode where the room interior and lighting remain inspectable even with a ceiling.
- Document actual technique: shadow maps, ray-query-like compute traversal, software ray/path tracing, or another supported approach. Benchmark on a realistic WebGPU device and make backend support and quality/performance tradeoffs explicit; report unsupported features rather than implying parity.

**Validation scenarios**
- Moving a light produces visibly changing wall shadows.
- A spotlight has a bounded cone and responds to angle changes.
- Ceiling light remains at its intended world location after camera movement.
- Invalid light placement outside ceiling is prevented or clearly handled.
- If a room becomes unclosed, its attached light's behavior is defined and tested.

### Stage 4 — More component variations

Explore the transition from individual pieces to reusable component definitions, variants, and nested assemblies.

Explore alternate walls, doors/windows, trims, nested assemblies, component definitions separate from instances, parameterized variants, and reusable blueprints. Introduce only the abstraction necessary for the experiment at hand.

### Stage 5 — Patterns and auto-generation

Explore how patterns and partial blueprints describe families of possible constructions, and how local compatibility can be combined with broader validation.

Explore corridor/room patterns, partial blueprints, compatibility constraints, local WFC-like layout, and global validation. Refer to `research/semantic-construction-grammar/README.md` for the larger conceptual vocabulary. Do not prematurely implement the full requirements/satisfaction graph.

## 4. Conceptual data separation, without premature interface contracts

The existing app can contain all parts. Maintain clean conceptual boundaries:

```text
Editor interaction / commands
  -> Construction state (wall instances, transforms, grid, lights)
  -> Derived topology / generated surfaces
  -> Scene projection (render geometry, materials, camera, lights)
  -> WebGPU renderer
```

The renderer **must not own the authoritative wall placement**. Manipulation changes construction state; the WebGPU renderer consumes its resulting scene. GPU buffers are disposable derived resources. The sandbox-local boundary in Stage 0.5 is deliberately narrower than an abstract renderer SDK. Define a portable, versioned scene save format when persistence is implemented, but do **not** create a native DX12 project or premature universal component hierarchy.

Illustrative, nonbinding record:

```json
{
  "schemaVersion": 1,
  "grid": {"spacing": 1.0, "snapEnabled": true},
  "walls": [
    {"id": "wall-1", "length": 4.0, "height": 3.0, "thickness": 0.15,
     "position": [0, 0, 0], "yawDegrees": 0}
  ],
  "lights": [
    {"id": "light-1", "type": "spot", "position": [1.3, 3.0, 1.7],
     "intensity": 900, "color": [1.0, 0.95, 0.86], "coneDegrees": 45}
  ]
}
```

Units, coordinate conventions, light units, file format, and pivot conventions are **illustrative and must be documented before code relies on them**. The first release can keep scene state in memory; persistence may follow once editing is reliable, but should not be forgotten.

## 5. UX details worth deciding during implementation

- Construction plane visible while editing, with a toggle to reduce visual clutter.
- Camera orbit, pan, zoom; quick top view and perspective view.
- Placement preview distinct from selected object.
- Move/rotate affordances or gizmos with clear axis/plane constraints.
- Snapping feedback: grid lines, wall endpoints, rotation increments; no accidental jumps.
- Wall endpoint and joint semantics should support reliable closed-loop detection.
- Escape cancels placement/drag; undo/redo covers user edits.
- Keyboard shortcuts may be convenient, but discoverable Fluent UI controls are required.
- Ceiling visibility toggle or cutaway makes interior lighting usable.
- Lighting controls do not require a full material editor.

## 6. Technical and quality constraints

- Browser WebGPU availability requires a supported browser and secure context (localhost or HTTPS). Distinguish an insecure context from unsupported WebGPU and initialization failure in diagnostics.
- Keep graphics JavaScript interop contained and avoid duplicating authoritative scene state in C# and JS without explicit synchronization.
- Handle canvas resize, WebGPU device loss, render loop lifecycle, and disposal of GPU resources.
- Consider pointer events, hit-testing/picking, camera navigation, and DPI scaling from the beginning.
- Build/test in CI; ensure browser runtime can actually render, not just compile, before claiming functionality.
- Keep rendering and UI responsive; avoid forcing GPU resource reconstruction on every trivial editor event where incremental updates suffice.
- Avoid adding a heavy game engine or external runtime without an explicit reason.
- No need to optimize for huge worlds, distributed systems, or generic asset import yet.

## 7. Documentation cleanup: required deliverable

The owner explicitly wants **thorough cleanup**, not more dead-end documentation. During the eventual implementation:

1. **Rewrite** `sandboxes/modular-apartment-playground/README.md` as the authoritative sandbox guide: purpose, current working features, run/build/test commands, browser/GPU requirements, controls, limitations, deployment, and next experiments.
2. Remove obsolete rotating-room instructions and old architectural claims that no longer match the code.
3. Audit `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/OPEN_QUESTIONS.md`, `docs/DECISIONS.md`, repository README, agent instructions, and relevant workflows for inaccurate references.
4. Preserve **historical** decisions in `docs/DECISIONS.md` (notably D-003/D-005) and mark superseded portions with a reference to the new decision; don't rewrite history as if earlier decisions never happened.
5. Keep `research/semantic-construction-grammar/` untouched: it is ongoing conceptual research, not the sandbox's implementation spec.
6. Ensure no contradictory docs claim an unimplemented feature is working. Distinguish *implemented*, *planned*, and *exploratory*.
7. Delete redundant sandbox-local dead ends when safe; keep useful provenance/history in Git. Prefer one concise README and a small number of justified supporting documents.
8. Validate every documented command and every link affected by the change.

**Do not perform this cleanup now** as part of this documentation-only handoff; it belongs to the authorized implementation PR.

## 8. Agent workflow and completion evidence

After the owner separately authorizes implementation:

- Create a feature branch and PR; do not commit destructive replacement to `main`.
- Audit current code and record a short keep/remove/replace plan.
- Implement in small, runnable increments, establishing a simple WebGPU scene renderer before sophisticated rendering and letting semantic-construction experiments inform subsequent editor work.
- Add focused tests for grid snapping, transforms, wall topology, and serialization; use visual/manual verification for editor UX and lighting.
- Validate the .NET build, GitHub Actions workflow, and (where accessible) browser runtime.
- Update docs *in the same PR* as the code, with screenshots or a short demonstration if feasible.
- In the PR, clearly distinguish verified features, remaining limitations, and next experiments.

## 9. Open questions — do not silently decide consequential tradeoffs

1. Should wall lengths be fixed per piece, resizeable, or both? A single fixed wall length is acceptable initially.
2. Which Planet Coaster manipulation interactions are essential in v1 (drag handles, rotate gizmo, shortcuts, multi-select)?
3. What grid spacing, wall dimensions, and coordinate/pivot conventions feel natural?
4. Are corners mitered, overlapped, or simply joined at shared endpoints initially?
5. **Stage 1 resolved:** Allow manually placed overlapping walls with a warning; leave near-touching ends separate. Later generation and topology rules remain open.
6. Should ceiling visibility be hidden automatically during edit or controlled manually?
7. What should happen to a light when its host ceiling disappears?
8. What is the acceptable WebGPU fallback when the requested ray-traced lighting is not practical on the target device?
9. Which browsers and devices constitute the first validation target?
10. Should scene save/load be required in the first demonstrable editor slice or immediately after?
Prefer reversible, minimal choices and document assumptions. Ask the owner when the answer would materially alter user-visible behavior or significantly increase complexity.

## 10. Existing repository context

- [Current sandbox](../../sandboxes/modular-apartment-playground/README.md)
- [Repository architecture](../../docs/ARCHITECTURE.md)
- [Decision log](../../docs/DECISIONS.md)
- [Open questions](../../docs/OPEN_QUESTIONS.md)
- [Semantic construction research](../../research/semantic-construction-grammar/README.md)

**Repository state when this brief was written:** Existing sandbox README describes a rotating room made of plain/window/door wall components; D-003 selects Blazor WASM + .NET 10 + Fluent UI + native WebGPU; D-005 records the original interchangeable-wall demo. This brief supersedes the **desired behavior of the sandbox**, not the historical record or the retained technology choice. A full source-code audit has **not** been performed for this handoff.

---

**Handoff rule:** The agent's job, once authorized, is to build a *small, usable construction-research workbench*, not to implement every idea in the research repository or finish every editor feature before research can begin. Keep the design simple, functional, testable, and easy to evolve.
