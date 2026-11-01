# Construction Grammar Sandbox — Current State and Open Experiments

**Status:** Stages 0.5 and 1 are implemented. Enclosures, ceilings, lighting in the construction editor, and grammar-driven generation are not implemented. No approach for those later experiments has been selected.

This sandbox is a small place to explore construction behavior by building and trying it. Its stages are useful topics, not a delivery contract or a requirement to complete one large editor. The core project's engine, architecture, and semantic grammar remain open.

## What is implemented

- A Blazor WebAssembly app using .NET 10, Fluent UI, and browser-native WebGPU.
- A WebGPU renderer that draws construction state supplied by the editor. Construction state is separate from GPU resources.
- One fixed-size rectangular wall type on an XZ plane, with Y up. Walls have stable instance IDs and remain independently editable.
- Placement preview and cancellation; selection by picking; move, rotate, duplicate, and delete operations.
- Optional position and rotation snapping, configurable grid visibility and spacing, camera orbit/pan/zoom, and undo/redo for wall edits.
- Warnings for crossing or overlapping walls. Normal end-to-end joins are allowed; near-touching ends are not automatically joined.
- In-memory scene state. Reloading the page discards edits.

The [sandbox README](README.md) is the practical guide to controls, commands, browser requirements, and known limitations. Focused JavaScript tests cover construction behavior and renderer/workbench diagnostics. They do not replace checking the app in a real browser and WebGPU device.

## What is not implemented

The construction editor does not infer closed boundaries, identify rooms, generate floors or ceilings, place ceiling tiles, or attach lights. It also has no wall variants, connector interfaces, persistence, requirement/capability graph, rule execution, or automatic layout generation.

The [semantic construction research notes](../../research/semantic-construction-grammar/README.md) remain conceptual. The [Rendering Sandbox](../rendering-playground/README.md) explores rendering techniques on a copied scene and separate reference scenes; its geometry and lighting experiments do not define construction-editor behavior or the core renderer.

## Open experiment: enclosed spaces and overhead coverage

The editor currently knows wall positions and endpoints, but it does not build topology from them. A loop of walls is therefore only a visual arrangement today; the app does not assign it the meaning of a room or space.

The next useful question is what observable behavior would help us learn from a bounded area. These are candidate experiments, not decisions:

1. **Show a closed-boundary hint.** Detect a simple loop of wall endpoints and highlight its outline, without creating a floor, ceiling, or semantic room. This tests when a boundary should count as closed.
2. **Place ceiling tiles manually.** Treat each tile as an explicit, editable piece. This tests whether overhead coverage is better authored as construction, including partial coverage and openings, rather than inferred from a wall loop.
3. **Generate a surface from a closed boundary.** Try a derived floor or ceiling only if seeing an automatically filled region answers a useful question.

Manual tiles could be a useful first ceiling experiment because they separate the player's decision to cover an area from the editor's interpretation of that area's walls. They raise concrete questions: should tiles snap to the existing grid, connect to wall tops, or support free placement; may gaps and openings remain; and should a tile imply enclosure or merely provide overhead coverage? None of these choices is settled.

A small progression could test wall-loop feedback first, then try a few manually placed tiles in the same scene. That would let us compare boundary detection and ceiling authorship without first committing to room semantics, automatic tiling, or a general topology system.

## Project boundaries

- This sandbox does not select the core project's engine or define a reusable renderer API.
- The renderer is WebGPU-only. WebGL2 remains deferred unless a concrete compatibility need appears.
- The project-wide physical-fit, preservation, optional-grid, explicit-connector, and style/geometry separation principles continue to apply to core project decisions; this small sandbox is not a complete implementation of them.
- Add or revise durable project records when an experiment leads to a substantive decision. Keep exploratory observations here or in conversation without turning each idea into a requirement.

## References

- [Project vision](../../docs/VISION.md)
- [Project architecture](../../docs/ARCHITECTURE.md)
- [Project roadmap](../../docs/ROADMAP.md)
- [Open questions](../../docs/OPEN_QUESTIONS.md)
- [Project decisions](../../docs/DECISIONS.md)
