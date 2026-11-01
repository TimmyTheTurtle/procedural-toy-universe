# Architecture — exploratory

No engine, programming language, storage format, or networking architecture has been chosen.

The browser sandboxes are research tools, not committed core architecture. The Construction Grammar Sandbox currently tests manual wall placement; the separate Rendering Sandbox tests renderer techniques. Their scoped technology choices and scene models do not settle core project contracts.

## Candidate domain concepts
- **Piece**: geometry/visual asset plus transform, bounds, optional grid settings, and zero or more connectors.
- **Connector**: local pose, type/interface, alignment constraints, and compatibility metadata; may be exposed through an assembly.
- **Assembly / Blueprint**: nested pieces and blueprints, local transforms, bounds, and explicitly published external connectors.
- **Scenery pack**: versioned library of assets, piece definitions, styles, and optional assembly templates.
- **Structure / Hull**: immutable or editable geometric envelope and fixed anchor features.
- **Grammar**: constraints and candidate module definitions for generating coherent spaces.
- **World instance**: seed, grammar/pack versions, established geometry, edits, and unresolved frontiers.

## Core invariants
1. All committed physical components fit inside the authoritative structure volume.
2. Existing committed observations and user edits are never silently rewritten.
3. Snap interfaces are optional; grid and free placement remain available.
4. Blueprint composition is recursive; interface exposure is explicit.
5. Generation validates collisions, clearance, connectivity, and remaining hard constraints.
6. A generator may reject a placement or return a valid fallback; it may not cheat geometry.

## Candidate generation lifecycle
Unresolved frontier -> gather local/global constraints -> enumerate compatible modules -> validate volume and connectivity -> select deterministically with a seed/context -> commit geometry and provenance -> persist. The exact deterministic selection method is an open design question.

## Important separations
- Geometry/attachment vs semantics (a snap point need not imply power or fluid transfer).
- Physical piece vs visual skin/material.
- Module library vs runtime instance.
- Hard constraints vs soft aesthetic preferences.
- Observed committed state vs latent possibilities.

## Questions to prototype
- How do inherited and custom connector interfaces coexist?
- What grid resolutions and rotation freedoms are supported?
- How are blueprint bounds and hull occupancy represented?
- How do we guarantee future feasible configurations without prematurely resolving unexplored spaces?
- How do simultaneous explorers avoid conflicting commits?
