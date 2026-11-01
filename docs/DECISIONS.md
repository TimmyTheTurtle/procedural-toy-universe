# Project Decisions and Significant Discussion

This is the durable record of consequential project decisions and the important discussions that led to them. It is a summary, not a transcript. See the project-wide requirements in [`AGENTS.md`](../AGENTS.md).

## Decisions

### D-001 — Maintain project questions and decisions in repository documentation

- **Date:** 2026-10-26
- **Status:** Superseded in applicability and timing by D-011; durable project records remain in use.
- **Decision:** Maintain substantive open questions, priorities, and concise answers in [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md), and maintain consequential decisions and summaries of materially relevant discussions in this file. Require all agents to consult and update these records through repository-wide instructions in `AGENTS.md` and the startup workflow. A skill may provide extra procedure later, but is not required for this behavior.
- **Context and rationale:** The user wants a persistent, prioritized question-and-answer ledger and a record of important conversations and their outcomes, maintained across agents and sessions. Durable tracked files plus always-on repository instructions are the chosen mechanism; full chat transcripts and routine exchanges are not needed.
- **References:** User-approved discussion on 2026-10-26; [`AGENTS.md`](../AGENTS.md); [`AGENT_BOOTSTRAP.md`](AGENT_BOOTSTRAP.md).

### D-002 — Organize learning demos as sandboxes with isolated checks and deliberate site deployment

- **Date:** 2026-10-26
- **Status:** Superseded by D-003 for the first sandbox's implementation stack; the separate, deliberate publishing policy remains.
- **Decision:** Call the independent small learning/demo directories `sandboxes/`. Run checks or builds for an individual sandbox on pushes that affect it. Keep publishing to GitHub Pages as a separate, deliberate action rather than deploying on every sandbox push. When multiple browser-based sandboxes are hosted together, assemble them into one Pages site artifact with each sandbox preserved under its own subdirectory and its own `index.html` entry point.
- **Context and rationale:** The imported deployment workflow was specific to one Blazor WebGPU app and deployed on pushes. The user clarified that browser sandboxes will be local HTML static sites, each suited to a distinct subdirectory, and accepted separating per-sandbox validation from deliberate web publication. A shared Pages artifact avoids independent deploys overwriting one another.
- **References:** User-approved workflow discussion on 2026-10-26; [imported workflow](../.github/workflows/deploy-blazor-webgpu.yml); [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md).

### D-003 — Build the first sandbox as a Blazor WebAssembly WebGPU playground

- **Date:** 2026-10-27
- **Status:** Accepted for the sandbox technology; the original rotating-cube scene request is superseded by D-017.
- **Decision:** Implement the first sandbox in `sandboxes/modular-apartment-playground/` as a stand-alone Blazor WebAssembly app targeting .NET 10, using Fluent UI Blazor for interface components and the browser's native WebGPU API through JavaScript interop. Give it a sandbox-scoped GitHub Actions build workflow. Keep Pages deployment separate and deliberate; its explicit trigger remains open under Q-008.
- **Context and rationale:** The user selected Blazor WebAssembly, Fluent UI, and WebGPU for the first sandbox and requested a full-width interface with a basic rotating cube. This sandbox choice does not select the engine or application stack for the core project, so Q-001 remains open. Unlike the prior assumption that browser sandboxes would be authored as local static HTML, this sandbox is a .NET application that publishes static web assets.
- **References:** User-approved implementation request on 2026-10-27; [sandbox README](../sandboxes/modular-apartment-playground/README.md); [sandbox workflow](../.github/workflows/validate-modular-apartment-playground.yml); [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md).

### D-004 — Publish the first sandbox to Pages manually

- **Date:** 2026-10-26
- **Status:** Superseded by D-018 for the published site layout; the manual-trigger policy remains.
- **Decision:** Publish `sandboxes/modular-apartment-playground/` through a separate GitHub Actions workflow triggered only by `workflow_dispatch`. Do not deploy on every sandbox push; the existing validation workflow remains responsible for push and pull-request checks.
- **Context and rationale:** The prior deployment workflow referenced missing `projects/grannys-house-trials/...` directories. A manual trigger makes site publication deliberate while the sandbox is still evolving and avoids coupling routine validation to public deployment. The repository Pages source must be set to GitHub Actions before the first deployment.
- **References:** User-approved workflow discussion on 2026-10-26; [publish workflow](../.github/workflows/deploy-blazor-webgpu.yml); [sandbox README](../sandboxes/modular-apartment-playground/README.md); [Q-008](OPEN_QUESTIONS.md).

### D-005 — Start the apartment scene with interchangeable wall components

- **Date:** 2026-10-26
- **Status:** Superseded by D-017 for the current sandbox scope; retained as historical context.
- **Decision:** The modular apartment playground's first scene should be assembled from interchangeable wall component definitions, initially including plain walls, window walls, and door walls. The UI does not need component editing controls yet.
- **Context and rationale:** This keeps the first construction increment focused on reusable scene composition while postponing editor UX. The component boundary supports later snapping, persistence, and blueprint work without hard-coding one apartment layout.
- **References:** User-approved implementation discussion on 2026-10-26; [sandbox README](../sandboxes/modular-apartment-playground/README.md).

### D-006 — Keep the repository public for accountless family viewing

- **Date:** 2026-10-27
- **Status:** Accepted
- **Decision:** Keep the repository public while family and friends need to view it without GitHub accounts. Public visibility means the repository is visible to everyone, not only the intended family audience. This does not grant an open-source license or allow accountless issue and pull-request participation.
- **Context and rationale:** The user wants family and friends to access the project before they have GitHub accounts. GitHub accounts will still be needed for interactive collaboration. Copilot billing controls are being handled separately.
- **References:** User clarification on 2026-10-27; [README](../README.md); [Q-009 and Q-010](OPEN_QUESTIONS.md).

### D-007 — Restrict public issue and pull-request creation to collaborators

- **Date:** 2026-10-27
- **Status:** Accepted
- **Decision:** Keep the repository publicly readable, but allow only collaborators to create issues and pull requests.
- **Context and rationale:** The user wants family and friends to browse the public repository without accounts, while limiting interactive participation to invited contributors. Accounts are required for issue and pull-request participation.
- **References:** User clarification on 2026-10-27; [repository settings](https://github.com/TimmyTheTurtle/procedural-toy-universe/settings); [Q-010](OPEN_QUESTIONS.md).

### D-008 — Organize certification study into three linked tracks

- **Date:** 2026-10-27
- **Status:** Accepted
- **Decision:** Organize the training materials into separate GH-600, AI-103, and AI-500 directories, with a training hub for shared Responsible AI practices and cross-references between tracks.
- **Context and rationale:** GH-600 is the current first target, while AI-103 and AI-500 remain active learning goals. Separate tracks keep certification-specific objectives and evidence distinct while making common principles easy to reuse.
- **References:** User direction on 2026-10-27; [training hub](../training/README.md); [GH-600](../training/gh-600/README.md); [AI-103](../training/ai-103/README.md); [AI-500](../training/ai-500/README.md).

### D-009 — Make the Certification Learning Coach a free-form Copilot learning lab

- **Date:** 2026-10-29
- **Status:** Accepted
- **Decision:** The Certification Learning Coach is a GitHub Copilot-oriented tutor that reads repository context, works only under `training/`, and teaches through conversation, fair practice, automatic track-specific revisit queues, and learner-approved exploratory programs. GH-600 is the default path; AI-103 and AI-500 are brought in when they provide useful prerequisites or deeper understanding, with AI-500 intentionally used for software-engineering and multi-agent depth. The coach proposes an experiment before building it, then may run it and help deploy it when the learner explicitly asks.
- **Context and rationale:** The owner wants discovery and real understanding rather than a fixed curriculum, rote memorization, or an evidence/approval bureaucracy. The coaching focus includes recognizing unfamiliar assessment wording, exposing prerequisites, revisiting misconceptions, and learning by making simple proof-of-concept programs.
- **References:** User-approved coaching discussion on 2026-10-29; [coach definition](../.github/agents/certification-learning-coach.agent.md); [training hub](../training/README.md); [component layout](../training/coach-agent-development/PACKAGE_LAYOUT.md).

### D-010 — Add Ada as an optional project engineering partner

- **Date:** 2026-10-30
- **Status:** Accepted
- **Decision:** Add Ada as a selectable GitHub Copilot engineering partner and include her manually invoked engineering-method reference library in this repository. The project copy uses repository skill references, with personal references as a fallback. Existing project instructions and the Certification Learning Coach remain applicable.
- **Context and rationale:** The user approved making Ada available in the Procedural Toy Universe checkout for collaborative discovery, design, and detailed implementation handoffs. The project copy can evolve independently and does not automatically synchronize with Ada's central repository.
- **References:** [Ada profile](../.github/agents/ada.agent.md); [engineering-method skill](../.github/skills/engineering-method/SKILL.md); [central Ada repository](https://github.com/TimmyTheTurtle/engineering-partner).

### D-011 — Use a lightweight, task-aware project workflow

- **Date:** 2026-10-30
- **Status:** Accepted
- **Decision:** Keep the project question and decision ledgers, while allowing exploratory conversations to remain conversational and read-only. Consult relevant records for substantive planning and update them during authorized work when a substantive outcome warrants it. Make full project bootstrap an optional, requested orientation; preserve project invariants and approval boundaries. This supersedes the mandatory per-conversation scope and timing in D-001, not the existence of the records.
- **Context and rationale:** The user requested friction-free exploration, targeted context, and autonomous execution within an approved phase, without repeated ledger prompts or mandatory full onboarding at every session.
- **References:** User-approved instruction revision; [`AGENTS.md`](../AGENTS.md); [optional orientation](AGENT_BOOTSTRAP.md); [D-001](#d-001--maintain-project-questions-and-decisions-in-repository-documentation).

### D-012 — Defer the WebGL2 compatibility renderer

- **Date:** 2026-10-31
- **Status:** Accepted
- **Decision:** Stage 0.5 of the modular apartment playground will use WebGPU only. Keep construction state independent of the renderer and report insecure-context, unsupported-WebGPU, and initialization failures clearly. Defer WebGL2 until testing demonstrates a concrete compatibility need.
- **Context and rationale:** Testing through localhost confirmed that WebGPU initializes on the previously failing system; the issue was the insecure plain-HTTP LAN origin, not hardware compatibility. A second renderer is therefore unnecessary for the current research foundation.
- **References:** [Construction Grammar Sandbox note](../sandboxes/modular-apartment-playground/CONSTRUCTION_WORKBENCH_BRIEF.md); user-approved scope update on 2026-10-31; [D-003](#d-003--build-the-first-sandbox-as-a-blazor-webassembly-webgpu-playground).

### D-013 — Start a separate rendering-research sandbox from the wall workbench

- **Date:** 2026-10-31
- **Status:** Accepted
- **Decision:** Create `sandboxes/rendering-playground/` as a separate copy of the current editable-wall playground, reusing its Blazor WebAssembly/.NET 10, Fluent UI, and WebGPU stack. Use the existing wall scene and renderer as a baseline for GPU-reuse research; do not select or implement alternate rendering techniques as part of this starting slice.
- **Context and rationale:** The existing construction playground places and edits walls well enough to provide a concrete, repeatable scene. Keeping a separate copy lets rendering experiments develop without changing that construction workbench. The sandbox-scoped stack choice does not select the core project engine or resolve the renderer/caching questions in the conceptual research.
- **References:** [Rendering Sandbox](../sandboxes/rendering-playground/README.md); [rendering-reuse research notes](../research/gpu-procedural-reuse/README.md); [D-003](#d-003--build-the-first-sandbox-as-a-blazor-webassembly-webgpu-playground).

### D-014 — Compare triangle shading with a ray-marched SDF vent wall

- **Date:** 2026-10-31
- **Status:** Accepted
- **Decision:** Add a selectable ray-marched renderer to the Rendering Sandbox alongside the editable triangle scene. The ray-marched mode uses a fixed reference vent wall defined by signed-distance functions, with separate WGSL source and toggleable steps; it does not replace or alter construction geometry.
- **Context and rationale:** A bounded reference wall allows a direct technique comparison while avoiding an initial conversion of the entire editable wall arrangement and construction grid into distance fields.
- **References:** [Rendering Sandbox](../sandboxes/rendering-playground/README.md); user-approved scope on 2026-10-31.

### D-015 — Add a matched procedural mesh and generated shadow-map comparison

- **Date:** 2026-10-31
- **Status:** Accepted for the Rendering Sandbox experiment
- **Decision:** Compare the bounded SDF reference hatches with matching generated triangle surfaces and cached light-space depth maps. Allow runtime-generated GPU maps, but no painted/imported image assets. Add shared pixel-resolution and greeble-count controls and repeatable GPU-completion measurements; preserve the independent editable construction scene.
- **Context and rationale:** The user wants self-shadowing and animated lighting with substantially more mathematical detail on a Surface Go 2, and approved testing the phased comparison. Matching geometry and sampling positions avoids benchmarking different scenes. This does not select a core renderer; instancing, normal/depth impostors, and accelerated analytic ray casting remain later experiments.
- **References:** [Rendering Sandbox comparison controls](../sandboxes/rendering-playground/README.md#matched-comparison-controls); [D-014](#d-014--compare-triangle-shading-with-a-ray-marched-sdf-vent-wall); user-approved phased comparison on 2026-10-31.

### D-016 — Add an SDF-only maintenance-bay rendering experiment

- **Date:** 2026-11-01
- **Status:** Accepted for the Rendering Sandbox experiment
- **Decision:** Add a separate selectable maintenance-bay scene to the Rendering Sandbox. Model the wall, floor, panel, pipes, fixed work light, and concealed pulsing electrical fault with signed-distance functions and render them with ray marching. Keep the existing editable triangle scene and hatch renderer comparisons available. Use view-independent surface normals for this scene so camera orbit does not change its lighting response.
- **Context and rationale:** The owner wants to reproduce the explored pipe-and-control-panel concept with basic mathematical shapes and functions, including protruding pipes, a reachable panel, work-light shadows, and a bright strobing fault behind the pipe bundle. This is a bounded rendering experiment and does not select a renderer for the core project or the Construction Grammar Sandbox.
- **References:** [Rendering Sandbox implementation](../sandboxes/rendering-playground/README.md); user-approved scope on 2026-11-01; [D-014](#d-014--compare-triangle-shading-with-a-ray-marched-sdf-vent-wall); [D-015](#d-015--add-a-matched-procedural-mesh-and-generated-shadow-map-comparison).

### D-017 — Treat the construction sandbox as a wall-editing research workbench

- **Date:** 2026-11-01
- **Status:** Current sandbox scope
- **Decision:** The Construction Grammar Sandbox is a small WebGPU wall-editing experiment: one fixed wall type, manual placement and manipulation, optional snapping, and in-memory state. It does not implement semantic grammar, enclosure detection, rooms, ceilings, or procedural layout. The core project stack and architecture remain open.
- **Context and rationale:** The sandbox has advanced from the original rotating-cube and interchangeable-wall scene to an editable construction workbench. Keeping its current behavior distinct from the broader vision prevents sandbox experiments from being mistaken for core architecture or completed grammar functionality.
- **References:** [Construction Grammar Sandbox](../sandboxes/modular-apartment-playground/README.md); [current sandbox state and enclosure experiment](../sandboxes/modular-apartment-playground/CONSTRUCTION_WORKBENCH_BRIEF.md); user request to bring the documentation current on 2026-11-01.

### D-018 — Publish both research sandboxes in separate Pages directories

- **Date:** 2026-11-01
- **Status:** Accepted
- **Decision:** Publish the Construction Grammar Sandbox under `/construction-grammar/` and the Rendering Sandbox under `/rendering/` in one GitHub Pages artifact, with a root index linking to both. Keep publication manual through `workflow_dispatch`; keep per-sandbox validation separate.
- **Context and rationale:** The user requested that both sandboxes be available on Pages in their own directories. Each Blazor app needs a base URL matching its subdirectory so framework assets and client-side routing continue to work.
- **References:** [Pages deployment workflow](../.github/workflows/deploy-blazor-webgpu.yml); [Construction Grammar Sandbox publishing instructions](../sandboxes/modular-apartment-playground/README.md); [Rendering Sandbox publishing instructions](../sandboxes/rendering-playground/README.md); [D-004](#d-004--publish-the-first-sandbox-to-pages-manually).

## Updating this record

- Give each consequential decision a stable `D-NNN` ID; do not reuse IDs.
- Record the date, status, decision itself, concise context/rationale, and references to relevant discussions, questions, issues, or documents.
- Record only decisions actually made by the user or an authorized project process. Distinguish accepted decisions from proposals, deferrals, and superseded decisions.
- When a decision changes, preserve the prior entry and mark it **Superseded** with a link to the replacing decision; do not silently erase the history.
- Summarize conversations only when they materially shaped a decision. Capture the issue considered, outcome, and rationale briefly; do not copy full transcripts or log routine chat.
