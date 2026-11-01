# Procedural Toy Universe

An open-source, engine-agnostic experiment in modular construction, constrained procedural discovery, and playable toy worlds.

## Vision
Build with freely placed scenery, grid-aligned pieces, and compatible snap connectors—then save assemblies as reusable blueprints. Blueprints may expose selected connectors and nest inside larger blueprints. Worlds, vehicles, buildings, and interiors are generated progressively as players explore, with discoveries becoming persistent.

The project is **not a Star Wars game**. Familiar science-fiction craft and locations are useful design examples, but the core and bundled assets must be original or properly licensed. Planet Coaster is a construction-workflow inspiration, not an asset source.

## Principles
- Physical geometry is authoritative: interiors must fit within their exterior hull or structure.
- No mandatory universal grid. Grid snapping, named connectors, and free placement can coexist.
- Blueprint interfaces explicitly expose compatible connectors; internal details can remain encapsulated.
- Unexplored spaces remain unresolved until observed. Once committed, player discoveries and edits persist.
- Procedural rules enforce spatial fit, connectivity, and established facts; failure is preferable to impossible geometry.
- Visual scenery, construction semantics, and future gameplay behaviors remain separable.
- Asset provenance and redistribution rights must be recorded before inclusion.
- No destructibility requirement in the initial construction milestone.

## Starting point
Read [docs/VISION.md](docs/VISION.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/ROADMAP.md](docs/ROADMAP.md). The first core-project prototype remains a proposed small 3D construction tool with reusable assemblies and constrained placement; its engine and implementation contracts are open. The [Construction Grammar Sandbox](sandboxes/modular-apartment-playground/README.md) currently explores manual wall construction, while the [Rendering Sandbox](sandboxes/rendering-playground/README.md) explores rendering techniques on a separate scene. Neither sandbox settles the core architecture or implements the full vision.

## Agent onboarding
Read [AGENTS.md](AGENTS.md). Copilot can use the `/initialize` skill from [`.github/skills/initialize/SKILL.md`](.github/skills/initialize/SKILL.md) where repository skills are supported. Codex should read `AGENTS.md` and may use the `initialize` skill under `.agents/skills/initialize/` where skills are supported. Both use the same instructions and project docs.

In the Copilot harness, select [Ada](.github/agents/ada.agent.md) for collaborative engineering discovery, planning, design, and implementation handoffs. Her [engineering-method skill](.github/skills/engineering-method/SKILL.md) is manually invoked; it does not automatically apply to other agents. This project copy does not automatically update from [Ada's central repository](https://github.com/TimmyTheTurtle/engineering-partner).

## Learning resources
- [Certification training hub](training/README.md) — GH-600, AI-103, and AI-500 study tracks with shared Responsible AI practices.

## Experiment sandboxes
- [Construction Grammar Sandbox](sandboxes/modular-apartment-playground/README.md) — editable walls and spatial placement for construction-grammar research.
- [Rendering Sandbox](sandboxes/rendering-playground/README.md) — a copied wall-scene baseline plus separate reference scenes for rendering experiments.

## Status
Core project is in concept / architecture exploration; its implementation stack is not chosen. Research sandboxes may use scoped stacks independently.

## Licensing
Code and original assets are **not yet licensed for redistribution** until an explicit LICENSE and asset-license policy are approved. Public visibility alone does not grant reuse rights. See [docs/ASSET_POLICY.md](docs/ASSET_POLICY.md).
