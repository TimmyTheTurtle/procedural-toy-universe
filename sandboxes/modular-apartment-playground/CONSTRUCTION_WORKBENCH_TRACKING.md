# Construction Workbench — Ideas and Discussions

This page tracks possible experiments for the Construction Grammar Sandbox. The [current brief](CONSTRUCTION_WORKBENCH_BRIEF.md) is authoritative for implemented behavior and the detailed enclosure experiment; the [semantic construction research](../../research/semantic-construction-grammar/README.md) provides broader conceptual context. Nothing on this page is an implementation commitment or a decision about the core project.

## Existing discussions

- [#8 — Review the editable-wall baseline](https://github.com/TimmyTheTurtle/procedural-toy-universe/issues/8) — original acceptance points and baseline review.
- [#9 — Explore enclosed spaces and overhead coverage](https://github.com/TimmyTheTurtle/procedural-toy-universe/issues/9) — wall boundaries, manual ceiling tiles, and possible derived surfaces.
- [#10 — Explore construction sandbox lighting and shadows](https://github.com/TimmyTheTurtle/procedural-toy-universe/issues/10) — lighting behavior, placement, shadows, and performance; its relationship to enclosure remains open.

## Candidate directions

These topics can be explored, reordered, combined, split into discussions, or dropped as we learn.

### Make the playground useful

- **Save and reopen:** Walls currently exist only in memory. What should a small persistence experiment preserve?
- **Editing responsiveness:** Viewport clicks wait about half a second to distinguish double-click camera reset. Is that disruptive, and what alternatives avoid unintended edits?
- **More pieces:** Compare a different wall size, doorway, or floor to expose fit and placement questions.

### Assemble and connect

- **Connectors:** Explore explicit connection interfaces and how they differ from grid snapping.
- **Reusable assemblies:** Find the smallest grouping interaction that keeps larger constructions composed of editable parts and allows nested blueprints to expose selected interfaces.
- **Patterns and alternatives:** Try a wall section that allows alternatives, such as a plain wall or doorway, without prescribing one resolved design.

### Explore meaning and generation

- **Spaces and rooms:** Explore when the sandbox should communicate physical enclosure versus functional purpose; open or shared areas may matter too. See [#9](https://github.com/TimmyTheTurtle/procedural-toy-universe/issues/9).
- **Needs and capabilities:** Find a small example showing why the presence of a component does not by itself prove a need is met.
- **Bounded generation:** Explore physical fit while respecting fixed structure and preserving observed or edited facts, without assuming a complete generator.

The [semantic construction research](../../research/semantic-construction-grammar/README.md) discusses these ideas in more depth. This list is a working index, not a complete inventory of the research or a fixed sequence of stages. Update it when useful and link focused discussions as topics develop.
