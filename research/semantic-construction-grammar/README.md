# Semantic Construction Grammar & Requirements-Driven Worldbuilding

**Status:** Ongoing design conversation / conceptual research subproject — **not an implementation plan, sandbox, or approved technical specification**  
**Initial meeting notes:** 2026-10-27  
**Parent project:** [Procedural Toy Universe](../../README.md)  
**Working shorthand:** *Semantic Construction Grammar* (SCG)

> **Core proposition:** A world is not merely assembled from compatible meshes. It is composed of physical structures that fulfill purposes. High-level needs decompose into requirements; lower-level components, spaces, networks, and assemblies offer capabilities; generation and simulation determine whether the resulting construction satisfies those requirements. Geometry can remain editable and may ultimately be defined mathematically.

This README is a **detailed synthesis of design conversations**, including relevant earlier discussions about the Procedural Toy Universe, architectural layering, procedural interiors, GPU geometry, and asset sourcing. It deliberately separates established intentions from proposals and open questions. It is not a verbatim transcript, and examples and illustrative schemas below are exploratory.

---

## 1. Why this subproject exists

The main Procedural Toy Universe combines the hands-on construction freedom of **Planet Coaster**, the recombinable authored chunks of **Diablo-like environments**, and the open-ended procedural/editable world systems of **Minecraft**, without requiring Minecraft's cube aesthetic. The broader inspiration includes LEGO/Kenner-like toy playsets, vehicles, spaceships, and settlements. A **KotOR Taris apartment** is a useful architectural reference exercise, **not** a declaration that this project is a Star Wars game or that copyrighted assets will be redistributed.

This subproject addresses the layer missing from a conventional snap-together editor:

- Why does a structure exist?
- What needs does a building, district, ship, room, *or non-room area* fulfill?
- Which smaller components and systems can satisfy those needs?
- How can a generator choose among acceptable combinations rather than require one complete blueprint?
- How can a construction remain editable, including subtraction of geometry, while its functional validity is continuously understood?
- How can a place carry social, economic, operational, and historical meaning rather than merely look plausible?

**Scope now:** Concepts, vocabulary, examples, relationships, design tensions, and research questions.  
**Not in scope now:** Implementing the engine, choosing an ECS or solver library, converting Quaternius assets, committing meshes or textures, defining final serialized schemas, or prescribing milestones.

The separate [Construction Grammar Sandbox](../../sandboxes/modular-apartment-playground/README.md) is a hands-on research aid, not an implementation of this conceptual model. It currently explores editable walls and spatial placement; enclosure meaning, requirement/capability relationships, and grammar-driven generation remain open.

## 2. Background and established project principles

### 2.1 Planet Coaster as interaction model, not world model

The user especially values **grid-assisted placement**, which makes modular construction easier and more predictable. The system should also support compatible named sockets/interlocks and free placement. The grid is an **optional spatial aid**, not a universal ontology: an organic surface, a pipe connection, and a rectangular wall bay need not share the same grid.

Pieces should be independently selectable and editable. Assemblies can be saved as blueprints, nested into larger blueprints, and expose selected connectors. A blueprint must never become an irreversibly fused mesh merely because it was optimized for rendering.

### 2.2 Diablo-like chunks and partial constructions

Not everything should be built wall-by-wall. Many useful units are **larger architectural chunks**: wall bays, corridors, alcoves, junctions, ceiling systems, service runs, door surrounds, staircase segments, apartment entry sections, or clusters of compatible pieces. Such a unit may be:

- A specific resolved assembly (blueprint).
- A family of acceptable assemblies (pattern).
- A partially specified arrangement with alternatives.
- A requirement-driven space whose actual construction is unresolved.

This is a key design departure from a conventional scenery editor. A pattern is not necessarily a room, and a room is not necessarily a fixed blueprint.

### 2.3 Procedural discovery and physical truth

The larger project envisions worlds, interiors, and playsets that can remain unresolved until discovered. A door may lead to an interior whose details are generated only when opened. Once discovered, its layout and player modifications persist. Generation must honor already committed facts and physical constraints. A ship's interior cannot be larger than its hull; fixed structural or system locations constrain later variation. Failure to resolve a configuration is preferable to impossible geometry.

### 2.4 Functional worlds and historical layering

The city-building reference includes places like **Taris and Coruscant**, where newer developments are built above and through older structures. A once-elegant wall with elaborate integrated lighting might later acquire exposed conduit, ducts, brackets, cheap replacement fixtures, structural reinforcement, and patched penetrations.

**Greebles should have plausible reasons to exist**: power, ventilation, access, mounting, maintenance, retrofit, damage, or decoration. A place's materials, lighting complexity, exposed infrastructure, and quality of repair can signal socioeconomic status, but these are contextual tendencies rather than universal rules.

This concept also connects to earlier game ideas involving ancient infrastructure, repairs, interconnected water systems, and the unintended consequences of local interventions: physical structures should participate in coherent systems, not simply decorate them.

---

### Visual: the two interacting hierarchies

The following recreates the paired requirements/construction diagram from our chat as a GitHub-native Mermaid diagram:

```mermaid
flowchart LR
  subgraph R["Requirements hierarchy"]
    R1["Habitable complex"] --> R2["Habitation + access + utilities"]
    R2 --> R3["Sleeping + lighting + airflow"]
  end
  subgraph C["Construction hierarchy"]
    C1["Residential complex"] --> C2["Apartments + corridors + plant"]
    C2 --> C3["Beds + lights + vents"]
  end
  C3 -. "provides capabilities / evidence" .-> R3
  C2 -. "collectively satisfies" .-> R2
  C1 -. "fulfills purpose" .-> R1
```

## 3. The key distinction: physical hierarchy versus semantic/requirements graph

A useful first approximation is:

```text
World / settlement / facility
  Functional zones and networks
    Spaces, activities, and rooms
      Architectural patterns and assemblies
        Construction components
          Geometry and materials
```

**This is a conceptual scale ladder, not a mandatory containment tree.** A ventilation network spans multiple rooms. One open-plan room supports several activities. A light may serve more than one area. A corridor is both a physical space and part of a circulation network.

We therefore distinguish at least two structures:

1. **Physical composition graph:** Which components and assemblies constitute which constructed objects? Where are they? How are they attached, nested, transformed, and modified?
2. **Semantic/requirements graph:** What purposes are served? Which requirements depend on which others? Which capabilities and verified relationships satisfy them?

Their edges need not align. A single service plant may satisfy the environmental requirements of dozens of apartments. A window may contribute daylight, visibility, ventilation, and comfort. A wall may be simultaneously a structural element, enclosure, privacy barrier, and host for a lighting fixture.

**Important distinction:** *Containment*, *composition*, *connectivity*, *service*, *dependency*, *satisfaction*, and *historical modification* are different relationship types. Do not silently conflate them.

## 4. Vocabulary under consideration

| Concept | Working meaning | What it is not |
| --- | --- | --- |
| **Source asset** | Imported reference geometry/material and provenance, e.g., Quaternius mesh | The final gameplay construction component |
| **Geometry definition** | Mesh, parametric function, SDF, procedural generator, or combination | Necessarily a permanent triangle mesh |
| **Construction component** | Selectable element with identity, geometry, anchors, interfaces, properties, and capabilities | Just an OBJ file |
| **Assembly** | Composition of components and/or nested assemblies | Necessarily a complete room |
| **Blueprint** | Resolved or substantially resolved arrangement with retained editable composition | An irreversibly flattened mesh |
| **Pattern / construction recipe** | Constraints and alternatives defining a *family* of acceptable compositions | One fixed blueprint |
| **Space** | Physical region, enclosed or open | Necessarily a room |
| **Functional area** | Region where an activity or service is supported, possibly overlapping other areas | Necessarily a physically partitioned space |
| **Room** | A spatial enclosure with geometric/boundary characteristics and optional assigned functions | Automatically meaningful merely because enclosed |
| **Function** | Purpose/activity/service: sleeping, circulation, maintenance, power distribution, socializing | A visual tag alone |
| **Requirement** | A need, constraint, target, or condition to satisfy | Automatically satisfied by the presence of a named object |
| **Capability** | What a component, space, assembly, or network can provide under stated conditions | Proof of performance in context |
| **Modifier** | Persistent, reversible change: cut, material override, attachment, damage, retrofit | Destructive rewrite of the source asset |
| **Generated representation** | Render mesh, GPU buffer, cached texture, impostor, acceleration structure | Authoritative source of truth |

Terminology is provisional. The important distinction is **what something is**, **what it can do**, **what is demanded of it**, and **whether the demand is actually met**.

### Visual: requirements decomposition

```mermaid
flowchart TD
  H["REQ-100: Habitation for two occupants"]
  H --> S["REQ-110: Sleeping capacity ≥ 2"]
  H --> A["REQ-120: Accessible circulation"]
  H --> L["REQ-130: Adequate illumination"]
  H --> E["REQ-140: Environmental support"]
  S --> B["Two pods OR one suitable double bed"]
  A --> D["Connected doors + traversable paths"]
  L --> P["Lighting fixtures + power + verified light levels"]
  E --> V["Ventilation terminal + functional network"]
```

## 5. A hierarchy of requirements — and why it is not strictly a tree

A top-level purpose should decompose into smaller functional, spatial, structural, environmental, operational, and aesthetic requirements.

Illustrative decomposition:

```text
REQ-100: Habitable residential complex
  REQ-110: Habitation capacity for population
    REQ-111: Sleeping capacity
    REQ-112: Personal space / privacy appropriate to context
    REQ-113: Access to food preparation or food services
  REQ-120: Safe circulation
    REQ-121: Traversable access to units
    REQ-122: Appropriate exits / route continuity
  REQ-130: Environmental services
    REQ-131: Illumination
    REQ-132: Ventilation / atmosphere
    REQ-133: Thermal comfort
  REQ-140: Infrastructure
    REQ-141: Electrical supply
    REQ-142: Waste handling
    REQ-143: Maintenance access
  REQ-150: Contextual character
    REQ-151: Architectural style / age
    REQ-152: Socioeconomic cues
    REQ-153: Evidence of historical alteration
```

This is a **sample**, not a fixed list of universal habitation requirements or a claim of engineering compliance. Requirements vary by world, culture, environment, occupancy, and game design.

### 5.1 Requirements relationships

Candidate relationships include:

- **ALL:** every mandatory child requirement must be satisfied.
- **ANY / alternatives:** one of several strategies can satisfy a requirement.
- **AT LEAST N / capacity:** e.g., enough usable sleeping capacity for two occupants.
- **Threshold / quantitative constraint:** minimum clearance, power budget, acceptable light levels.
- **Dependency / precondition:** a powered fixture contributes illumination only when power is available.
- **Redundancy / resilience:** more than one independent route or supply may be required.
- **Preference / soft constraint:** indirect lighting preferred for luxury spaces, without being universally mandatory.
- **Cross-cutting obligation:** accessibility, safety, maintenance, or service routing can apply across many branches.

A requirement hierarchy is a convenient human view; the underlying representation is likely a **typed directed graph** with cross-links, alternatives, and conditional satisfaction.

### 5.2 Capabilities flow upward; requirements flow downward

A high-level need requests functionality. Candidate spaces, patterns, assemblies, networks, and components advertise capabilities. A solver can propose a construction; a verifier evaluates whether those capabilities actually meet the requirements **in context**.

Examples:

- A bed offers nominal sleeping capacity, but a blocked entrance can make it unusable.
- A light emits light only if supplied with power; a lumen rating alone does not establish adequate illuminance at the task surface.
- A vent is not sufficient unless it is connected to a functioning airflow path.
- A door opening is not a valid circulation route if it leads nowhere or violates clearance.
- A wall may satisfy enclosure but fail structural or fire separation demands.

**Declared capability is not verified satisfaction.** This distinction is central to meaningful generation and simulation.

### 5.3 Shared and cross-scale satisfiers

One component may satisfy multiple requirements; one requirement may require multiple components. A shared utility plant can serve an entire building. An open-plan area can provide sleeping, work, and social functions without enclosing each activity in its own room.

The system must not assume a one-to-one relationship between requirements and components, nor between semantic and physical levels.

### Visual: corridor-pattern variations

This recreates the three illustrative corridor shapes from the chat. The same *semantic* circulation pattern can resolve into different geometries and connectors:

![Straight, corner and cross corridor variants](./corridor-patterns.svg)

## 6. The missing middle: patterns and acceptable combinations

The user wants **larger meaningful chunks** rather than only individual walls and furniture, but does not want every chunk to be a fully specified blueprint.

A **pattern** describes a valid family of compositions, such as:

- Corridor straight / corner / T-junction / cross-junction.
- Residential entry bay with several possible door surrounds and lighting configurations.
- Wall bay that may host windows, vents, conduits, trim, or damage.
- Sleeping nook with alternative bed/pod/storage configurations.
- Utility alcove with required service access and optional cabinet arrangements.
- A room or partial apartment defined by required areas and connectivity, not exact furnishings.
- A building or district described by service demands and topology rather than all constituent tiles.

Patterns can express local compatibility (edge types, socket matching, footprint, rotation, grid alignment), but also semantic conditions (access to a corridor, maintenance clearance, illumination, social status, expected wear, structural support).

**Blueprint:** a particular resolved arrangement.  
**Pattern:** a family of permissible arrangements.  
**Semantic specification:** what the arrangement must accomplish.

These can coexist at **every scale**. A pattern can contain fixed subassemblies and unresolved slots. A blueprint can deliberately leave some regions undecided.

### 6.1 Where Wave Function Collapse fits

WFC is a candidate technique for choosing among locally compatible tiles/patterns, especially on a grid. It is **not** the entire world generator. Global connectivity, service capacity, spatial fit, structural consistency, and functional adequacy may require graph search, constraint solving, backtracking, simulation, or other techniques.

No algorithmic stack has been selected. The design should not make WFC the semantic authority.

### 6.2 Resolution and persistence

The system should support partially resolved spaces. A high-level apartment specification may already commit its size, entrances, capacity, and connections while leaving furniture, internal partitions, and greebles unresolved.

When details are generated, they must respect those commitments. Once observed or edited, they persist. Future generation cannot overwrite established facts. The question of when a space becomes committed, and what remains mutable afterward, needs further work.

### Visual: one room, multiple functional areas

The following diagram recreates the illustrative open-plan apartment from the chat. Colored regions indicate **functional areas, not partitions or separate rooms**.

![Conceptual apartment with overlapping functional purposes](./functional-areas.svg)

## 7. Spaces, rooms, areas, and functions

**A functional area is not necessarily a room.**

One large apartment room may include a sleeping area, food preparation, socializing, and a workbench. A hangar floor can contain maintenance zones, storage zones, and circulation routes without walls between them. A corridor may double as service access. A ship compartment may contain nested equipment zones.

A *space* should describe geometry, boundaries, access, occupancy, and environmental conditions. A *function* should describe the activity/service and the requirements needed to support it. Assignments can overlap, change over time, or depend on equipment.

A room should not be considered complete or meaningful merely because four walls and a ceiling exist. Its **role and demonstrated functionality** make it useful to gameplay and generation.

Candidate questions for future research: Are functional areas explicit volumes, fuzzy influence regions, graph nodes, or some combination? How do activities share space over time? How does a function inherit or override a parent zone's requirements?

## 8. A concrete scenario: an apartment for two occupants

Start with a high-level need: **provide habitation for two people**.

Possible derived needs:

1. Sleeping capacity >= 2, satisfied by alternative combinations such as two pods or a suitable double bed.
2. Walkable access from an exterior or shared corridor.
3. Adequate lighting in relevant activity zones.
4. Environmental support (e.g., air, temperature), potentially delivered by shared infrastructure.
5. Food preparation **or** reliable access to shared food services.
6. Privacy, maintenance, and quality expectations dependent on social context.

A generator might choose a studio apartment, divided rooms, shared facilities, or compact modular pods. Those choices alter the geometry but can satisfy the same high-level need.

The verification step must check actual spatial accessibility, network connectivity, and performance rather than simply count furniture objects.

A **luxury** variant might express soft preferences or higher thresholds for concealed layered lighting, privacy, finish quality, redundancy, and maintenance access. A **lower-income** variant might rely on shared services, exposed utilities, repairs, and inexpensive fixtures. These should not be caricatures or immutable visual rules.

### Visual: one source, many meanings

```mermaid
flowchart TD
  Q["Quaternius source mesh"] --> C["Generic wall component"]
  C --> L["Luxury wall bay: trim + concealed lighting"]
  C --> U["Utility wall: conduits + exposed fixtures"]
  C --> D["Damaged wall: cuts + patches"]
  C --> I["Illuminated wall: emissive panels + power"]
```

## 9. Asset hierarchy and Quaternius as source material

The immediate asset candidate discussed is the **Quaternius Modular Sci-Fi MegaKit** (free Standard edition; published as roughly 190 modular models; CC0). Other reference packs discussed include Kenney's Modular Space Kit and Space Station Kit, Quaternius Ultimate Modular Sci-Fi and Sci-Fi Essentials, plus references for KotOR/Taris-style environments.

**Important provenance caveat:** The actual Quaternius Standard ZIP has **not yet been inspected in this design discussion**. Its precise object names, pivots, dimensions, material assignments, texture contents, and connector conventions remain to be verified. Do not treat illustrative mesh names or dimensions as factual inventory.

One imported source mesh may underpin several construction components; one component may combine several meshes, procedural geometry, and functional interfaces. A wall may be a generic structural/enclosure component; a luxury wall bay, utility wall, damaged wall, or illuminated wall may be specialized assemblies or configurations built from it. Avoid duplicating source geometry for every variation.

A useful conceptual separation:

```text
Imported source assets
  -> component definitions (geometry + behavior + interfaces)
  -> assemblies / patterns / blueprints
  -> placed instances with local configuration and modifiers
  -> generated render / physics representations
```

These are **responsibilities**, not necessarily a final number of files or class types.

### 9.1 Candidate metadata families

- **Identity:** stable IDs, versioning, origin/provenance, licensing, source hashes.
- **Geometry:** source reference or mathematical recipe, dimensions, local coordinate frame, bounds, origin, collision/solid assumptions.
- **Placement:** optional grid alignment, anchors, snap sockets, allowed transforms, compatibility.
- **Composition:** children, nested assemblies, exposed interfaces, unresolved alternatives.
- **Materials:** slots, parameters, shader/material functions, overrides.
- **Capabilities:** enclosure, support, illumination, airflow, power supply, passage, sleeping capacity, etc.
- **Requirements/dependencies:** power input, support, service connectivity, access clearance, resource consumption.
- **Functional interfaces:** electrical, mechanical, fluid, data, structural, circulation.
- **Modification:** paintable, cuttable, attachable, replaceable; persistent modifier history.
- **Semantics:** intended roles, activities, architectural era, quality, socioeconomic context, maintenance state.
- **Verification:** required checks, evidence, dependency state, unresolved assumptions.

Capabilities should be **optional and composable**, not an enormous rigid record where every object carries irrelevant fields.

### 9.2 Git-friendly source philosophy (future, not a current conversion task)

Long term, prefer text-defined authoritative assets where practical:

- OBJ is textual and can preserve imported meshes, but can generate noisy diffs when vertex order changes.
- JSON/YAML can describe metadata, assemblies, requirements, and parametric geometry.
- GLSL/HLSL can express procedural materials and geometric functions.
- SVG can describe geometric markings, decals, and certain texture sources.
- Plain-text PPM **P3** can encode pixel images, though large images are bulky and diffs can be noisy.
- Efficient binary meshes/textures/GPU resources can be **generated caches** rather than authoritative definitions.

This is a direction, **not a ban on binaries at all costs** and **not a commitment to convert the Quaternius pack now**. Original asset licensing and provenance still matter; game-derived KotOR assets are not automatically redistributable.

### Visual: one mathematical grille definition, several configurations

![Three grille variations produced from a single parameterized definition](./parametric-grilles.svg)

## 10. Mathematical geometry, procedural greebles, and GPU rendering

The user ultimately prefers **mathematical definitions of geometry**, not merely mathematically generated textures.

Examples include parameterized walls, curved moldings, pipes, ventilation grilles, structural ribs, panel seams, and greeble arrays. A reusable function such as `VentGrille(width, height, depth, slatCount, slatAngle, bevelRadius)` can describe many differently scaled and transformed instances.

Possible representations include parametric surfaces, constructive solid geometry (CSG), signed distance functions (SDFs), conventional meshes, or hybrid definitions. **Do not assume SDFs are universally best.**

For repeated detail, domain repetition, coordinate folding, GPU instancing, shader patterns, impostors, texture tiling, and caching are all relevant concepts. Reusing a definition or pre-rendered appearance reduces repeated *authoring* and some computation, but visible pixels still cost GPU work. The aspiration is high reuse with appropriate representations at different scales, not literally free rendering.

**Critical separation:** mathematical *source* does not require evaluating every mathematical function every frame. A component can be compiled/baked/cached into an appropriate render representation while retaining its editable source identity.

### Visual: subtractive geometry

```mermaid
flowchart LR
  W["Original wall / solid"] --> B["Boolean difference"]
  C["Editable cylinder or box cutter"] --> B
  B --> O["Wall with opening"]
  O --> M["Optional duct, sleeve or window assembly"]
```

The cutter remains an independently editable modifier; the source wall is unchanged.

## 11. Non-destructive subtractive geometry / CSG

The user explicitly wants the ability to **cut a hole in a wall**, potentially early but not immediately.

Treat cutters as persistent, editable **modifiers**, not destructive changes to an imported source mesh. A cutter may be a box, cylinder, spline extrusion, or eventually arbitrary function. A duct assembly might carry a required opening that affects a wall and its cladding; the resulting opening can also expose a connection interface for the installed duct or sleeve.

For signed distance fields, an illustrative subtraction is:

```text
distance_result(p) = max(distance_wall(p), -distance_cutter(p))
```

This is straightforward for suitable SDFs but **not automatically straightforward for arbitrary imported OBJ meshes**, which may be non-watertight or otherwise unsuitable for mesh booleans. Candidate future paths include robust mesh booleans, suitable mesh-to-SDF conversion, or replacement of imported architectural elements with parametric solids. No implementation choice has been made.

Requirements should be re-evaluated after a modification: a cut may disrupt structure, enclosure, privacy, fire separation, airflow, or access; adding a duct may repair ventilation while introducing new power and maintenance needs.

## 12. Persistent requirements as gameplay simulation

A major consequence of the requirements model: **requirements should remain alive after generation**.

- Remove a supporting column: structural requirements may become unsatisfied.
- Disconnect a power cable: lighting and equipment lose their supply.
- Block a doorway: circulation may fail.
- Cut an opening: enclosure or structural requirements may change.
- Retrofit a duct: ventilation may improve, but maintenance clearance or noise may worsen.
- Add a new residential level: load, circulation, utility, and waste demands propagate through existing infrastructure.

This creates gameplay based on **understanding and repairing systems**, rather than collecting a checklist of decorative objects. It also enables local fixes to cause distant consequences, a recurring theme in the broader project.

Verification can be incremental in principle: changes invalidate affected satisfaction claims rather than requiring every requirement in the world to be recomputed. The dependency model and computational strategy remain open questions.

## 13. Architectural history and socioeconomic meaning

Buildings should accumulate **layers of intervention**:

1. Original architecture, materials, and integrated systems.
2. Changes of use or ownership.
3. New infrastructure routed through existing structures.
4. Repairs, damage, substitutions, and partial failures.
5. New construction above, beside, or through older layers.

The older structure remains conceptually present. Modifiers and later assemblies can reveal or conceal it, allowing exploration and potentially reversal. This is especially compelling in vertically layered sci-fi cities.

Lighting is a particularly expressive example. Affluent environments may have complex concealed architectural lighting, indirect coves, recesses, integrated diffusers, and carefully planned lighting zones. Poorer or heavily retrofitted environments may expose cheaper, serviceable fixtures, conduits, and mounting hardware. Exceptions and histories matter; an old luxury corridor may have cheap replacement lights after decades of neglect.

Greebles are **evidence of function and history**, not random noise. Ideally, a player can infer how a place works by looking at it.

## 14. Working example: requirement-driven corridor construction

A corridor segment can be specified semantically without prescribing one blueprint.

Illustrative (non-final) sketch:

```yaml
id: residential.corridor.section
purposes: [circulation, residential_access]
requirements:
  - continuous_walkable_path
  - adequate_clearance
  - illumination
  - apartment_access
composition:
  allowed_patterns:
    - corridor.straight
    - corridor.corner
    - corridor.junction
    - corridor.doorway
style_context:
  era: layered_residential
  condition: maintained
resolution:
  approach: constrained_generation
  unresolved_regions_allowed: true
```

A candidate layout may satisfy tile adjacency but fail apartment access, power distribution, or global connectivity. Such failures must be detectable and explainable.

## 15. Architectural principles worth retaining

These are **strong design directions**, not approved implementation decisions:

1. **Meaning is not reducible to geometry.** Physical enclosure and functional purpose are separate concepts.
2. **Grid is an interaction tool.** Snapping is optional; it should not dictate every spatial representation.
3. **Source identity survives representation changes.** Replacing an OBJ with a mathematical function must not invalidate every existing assembly.
4. **Blueprints remain decomposable.** Runtime flattening/caching cannot erase source composition.
5. **Patterns, blueprints, and specifications are distinct.** They can exist at any scale and coexist within one construction.
6. **Requirements and capabilities are many-to-many.** Avoid matching requirement levels one-to-one with component levels.
7. **Satisfaction is verified, not assumed.** Context, networks, geometry, and dependencies matter.
8. **Generation may remain partial.** Unobserved details can be unresolved; observed and edited details persist.
9. **Physical constraints are authoritative.** No impossible interiors or disconnected services hidden behind procedural convenience.
10. **Modifications are non-destructive in the source model.** Cutters, retrofits, and damage remain identifiable and editable.
11. **History has causal structure.** Later interventions alter older construction for reasons.
12. **Math-first is an eventual asset direction.** Rendering may use cached, baked, or optimized representations.
13. **Source provenance matters.** Public references are not automatically reusable assets.
14. **Research stays separate from implementation.** This directory should be a stable home for continued conceptual exploration.

## 16. Unresolved design questions for future conversations

### Semantics and requirements
- What is the smallest useful set of relationship types for requirements decomposition, alternatives, dependencies, and satisfaction?
- Do we distinguish *needs*, *requirements*, *preferences*, *goals*, *constraints*, and *capabilities* explicitly?
- How do we express a requirement shared by multiple spaces or satisfied by a remote infrastructure system?
- What counts as proof of satisfaction, and how do we represent uncertainty or approximate verification?
- How do requirements change with time, occupancy, damage, scarcity, culture, or player intent?

### Spatial composition
- What exactly is a *space* when boundaries are incomplete, dynamic, or open?
- How are functional areas represented when they overlap and change with activities?
- How do patterns expose unresolved alternatives and compatibility rules?
- How do grids, named connectors, free placement, and procedural curves coexist?
- How do physical composition and semantic relationships remain navigable for players?

### Procedural generation
- How do we coordinate local pattern selection with global access, service networks, and structural requirements?
- Which facts must be committed before an interior is revealed?
- How do partial blueprints and deferred generation retain stable IDs and deterministic behavior?
- How can the generator explain *why* it selected a component or rejected an arrangement?

### Geometry, materials, and modification
- What is the long-term canonical mathematical geometry vocabulary?
- How do cutters affect multi-layer assemblies, collision, service interfaces, and structural validation?
- When should geometry be rendered analytically, meshed, instanced, tiled, or baked?
- What does a minimally lossy, Git-friendly Quaternius import look like after inspecting the actual package?
- How do procedural material functions encode age, wear, socioeconomic context, and historical intervention?

### Gameplay
- How visible should requirements and satisfaction be to the player?
- Are requirements strict rules, simulation outcomes, design goals, or all three depending on context?
- How does a player intentionally violate requirements and experience the consequences?
- Can repairs and retrofits be evaluated by system-wide effects rather than local appearance?

## 17. Discussion record / chronology

### Earlier Procedural Toy Universe discussions (2026-10-24 to 2026-10-26)
- Proposed a toy/playset universe inspired by Planet Coaster construction, LEGO/Kenner-like modularity, procedural discovery, vehicles, and functional interiors.
- Established recursive editable blueprints, optional grid and connectors, deferred interiors, persistent discovery, and physical fit within hulls.
- Distinguished Diablo-like modular man-made environments from Minecraft-like editable natural worlds without cube aesthetics.
- Explored GPU mathematical geometry, SDF/ray marching, repetition, instancing, and the limits of rendering repeated detail cheaply.

### Asset and architectural discussions (through 2026-10-27)
- Selected Quaternius Modular Sci-Fi MegaKit as a promising **candidate source pack** for experimenting with modular architecture; actual archive inspection remains outstanding.
- Discussed Taris apartment reconstruction as an illustrative use case; highlighted lighting, architectural trim, socioeconomic signaling, and accumulated retrofits.
- Preferred text-friendly authoritative source assets, especially mathematical materials and ultimately mathematical geometry; binary GPU representations can be derived.
- Introduced non-destructive CSG cutters as first-class future modifiers, including holes for ducts and other infrastructure.

### Semantic hierarchy discussion (2026-10-27)
- User emphasized **larger semantically meaningful chunks**, acceptable combinations, partial blueprints, WFC-like resolution, and meaningful rooms and areas.
- Proposed a scale ladder from world/facility through zones, spaces/activities, patterns/assemblies, components, and geometry.
- Recognized that physical containment and functional/service relationships form different graphs.
- Distinguished **pattern**, **blueprint**, and **semantic specification**.
- Separated **functional area** from **enclosed room**.
- Suggested high-level requirements flow downward and component/network capabilities contribute upward.
- User explicitly proposed a **hierarchy of requirements across layers**, with smaller functions satisfying individual requirements of much larger needs.
- Developed examples of habitation capacity, circulation, lighting, ventilation, and infrastructure dependencies.
- Identified persistent requirement evaluation after construction and modification as a potential core gameplay mechanic.

### Decision for this repository (2026-10-27)
- Preserve this work as a **clearly discoverable side research project**, beginning with a detailed README.
- **Do not** begin implementation, import Quaternius assets, or create Git-friendly geometry/material components as part of this step.

## 18. External reference starting points

- [Quaternius — Modular Sci-Fi MegaKit](https://quaternius.com/packs/modularscifimegakit.html)
- [Kenney — Modular Space Kit](https://kenney.nl/assets/modular-space-kit)
- [PyKotor](https://github.com/OpenKotOR/PyKotor) and [KotORBlender](https://github.com/seedhartha/kotorblender) — reference tools for later examination of legitimately owned game files; not blanket redistribution permission.
- Parent repo: [Vision](../../docs/VISION.md), [Architecture](../../docs/ARCHITECTURE.md), [Asset Policy](../../docs/ASSET_POLICY.md).

---

## 19. How to use this subproject

Treat this README as the **first meeting record and conceptual baseline**. Future discussions can refine terms, challenge assumptions, add examples, and document alternatives without prematurely freezing a technical design. New research notes or decision records can eventually live alongside it, but no directory structure beyond this README is required yet.

**Next conceptual question:** How should requirements be represented and decomposed so that a building, a functional area, a corridor pattern, a service network, and a tiny component can all participate in one explainable satisfaction graph?
