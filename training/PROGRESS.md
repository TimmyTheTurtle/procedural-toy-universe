# Certification learning progress

This is the tutor's lightweight memory of meaningful learning. It records what
has been explored, the learner's current understanding, and the next useful
move. It is deliberately small enough to read in a conversation and regular
enough for a future dashboard to parse.

It is not a scorecard, a completion gate, or a transcript. Keep the
track-specific `TEST_ME_LATER.md` files for concepts that should be retested.

## Conventions

- Use ISO dates (`YYYY-MM-DD`) and stable IDs such as `GH600-001`.
- Use **new**, **exploring**, **can explain**, **can apply**, or
  **revisit** for current understanding. These are conversation-based signals,
  not grades.
- Add or update a concept only when a meaningful exchange changes what is
  known, uncertain, or useful to do next.
- Keep one row per concept or question style; update it instead of creating
  duplicate rows. Cross-track rows may name more than one track.
- Never record credentials, endpoints, private account details, or real exam
  content.

## Current focus

| Track | Starting point | Current focus | Updated |
|---|---|---|---|
| GH-600 | Default starting track | Connect issues, branches, and pull requests to agent workflows; begin exploring agent evaluations. | 2026-11-03 |
| AI-103 | Connected Azure application track | Bring in when Azure/Foundry application practice adds useful depth. | 2026-10-29 |
| AI-500 | Deep multi-agent and software-engineering track | Bring in when a concept benefits from deeper orchestration, evaluation, operations, or deployment context. | 2026-10-29 |

## Concept memory

| ID | Track | Concept or question style | Current understanding | Why it matters / next useful move | Last touched |
|---|---|---|---|---|---|
| GH600-001 | GH-600 | Issues, pull requests, and agent workflows | exploring | Learner distinguished issue discussion from proposed file changes and recognized that a PR needs changes to review; revisit branches, draft specifications, and the agent's role in a new scenario. | 2026-11-03 |
| GH600-002 | GH-600 | GitHub Projects for cross-repository planning | exploring | Learner wants to revisit setting up Projects and draft ideas later; keep setup separate from immediate GH-600 study. Projects are related context, not explicitly listed as a measured skill in the current guide. | 2026-11-02 |
| GH600-003 | GH-600 | Agent evaluation and focus drift | new | Learner identified evals as an unfamiliar area; use the coach's drift into product specification to explore scenarios, expected behavior, assessment, and iteration. | 2026-11-03 |

## Learning activity

| Date | Track | Kind | What changed or was learned | Follow-up / location |
|---|---|---|---|---|
| 2026-10-29 | All | Baseline pending | The learning memory is ready; no learner study conversation has been recorded yet. | Begin the first GH-600 conversation. |
| 2026-11-02 | GH-600 | Baseline | Learner identified the issue-to-PR flow and the role of agents as a prerequisite they want explained with multiple videos. | Revisit issue versus reviewable file changes. |
| 2026-11-03 | GH-600 | Practice and discovery | Discussed issue versus PR and identified the coach's product-specification drift as a possible evaluation scenario. Learner identified context and agent activity as possible evidence sources. | Revisit evaluation design and failure analysis; [focus-drift handoff](coach-agent-development/FOCUS_DRIFT_HANDOFF.md). |

## Experiments and assessments

| ID | Date | Track | Type | What it explored | Outcome / next move | Location |
|---|---|---|---|---|---|---|
| GH600-A01 | 2026-11-03 | GH-600 | Informal practice | Issue, proposed file changes, PR, and diagnosing agent drift. | Distinguished issue discussion from reviewable changes; identified activity and context as possible evidence. Revisit evaluation design in a changed scenario. | [Revisit queue](gh-600/TEST_ME_LATER.md) |
