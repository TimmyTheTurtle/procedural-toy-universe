# Roadmap (proposed, not committed)

This roadmap describes possible work on the core project. The [Construction Grammar Sandbox](../sandboxes/modular-apartment-playground/README.md) and [Rendering Sandbox](../sandboxes/rendering-playground/README.md) are scoped experiments; progress there does not complete these stages or select the core implementation stack.

## 0 — Foundation
Choose engine/language, licensing, asset metadata policy, build/test tooling, and repository conventions. Capture architectural decisions in docs/adr/.

## 1 — Construction vertical slice
Place a few primitive walls/floors/doors with grid snapping, connector snapping, and free placement. Save and reload a blueprint. Publish selected connectors from the assembly.

## 2 — Recursive assemblies
Nest blueprints, transform interfaces, validate compatibility, and handle invalid placements. Add deterministic tests.

## 3 — Bounded procedural interiors
Define a simple fixed hull, hard anchors, and unresolved door frontiers. Generate a room only on discovery; persist committed geometry and reject impossible layouts.

## 4 — Scenery packs
Versioned generic asset packs, visual substitutions, metadata, and provenance checking. Use CC0 or appropriately licensed source assets only after review.

## Later possibilities
Interactive systems, equipment, vehicles, multi-user exploration, planet generation, puzzle/narrative grammar, and destruction.

## First decision
Select the smallest technical stack that can demonstrate snap interfaces and saved nested blueprints, without committing to a full game engine prematurely.
