---
description: Use when exploring a topic through flexible steps or experiments in a learning sandbox; keep suggestions provisional and completed work reproducible.
applyTo: 'sandboxes/**/step-*/**,sandboxes/**/*_step*'
---

# Flexible Learning Sandbox Progression

## Scope

Use this guidance when a sandbox is intentionally organized as a sequence of learning steps or experiments, regardless of programming language, framework, or build system. A numbered path can activate this instruction, but numbering does not make the sequence fixed.

When working in an active file outside these path patterns, consult this instruction explicitly if the sandbox uses steps or experiments. Do not impose a step structure on an ordinary sandbox merely because it is under `sandboxes/`.

## Working approach

- Treat steps, experiment ideas, and their ordering as provisional suggestions, not requirements or a committed roadmap.
- Work out the next experiment with the user as the project evolves. Do not predefine every step or assume that a proposed experiment must happen.
- Keep the active experiment easy to find, and keep a concise, easy-to-find list of other ideas to explore when the sandbox has multiple possible directions. The list may be reordered, expanded, combined, or dropped as understanding changes.
- Preserve a useful comparison point, such as a baseline mode, when it helps explain what an experiment changes. A reversible option within one app can be a better learning artifact than a separate numbered implementation.
- Keep unrelated research options out of scope until selected for exploration. An idea list is not authorization or a commitment to implement.

## Preserve learning artifacts

When an experiment or step is considered complete, keep enough of its implementation and context to understand, reproduce, and compare it later. Choose the lightest layout that fits the sandbox:

1. Keep useful baseline behavior available when the experiment changes a shared implementation.
2. Preserve distinct source, configuration, or run instructions when they are needed to reproduce a completed experiment.
3. Do not silently rewrite completed artifacts. If correcting one is necessary, make the correction explicit and record why.
4. Keep active run/build configuration clear, and isolate archived implementations if they would conflict when built together.
5. Record a concise takeaway and the experiment's status in the sandbox's existing documentation when useful. Do not mark an experiment complete, or treat its result as a project requirement, just because implementation or discussion began.

## Choosing an artifact layout

Follow the sandbox's conventions and use the smallest structure that makes the experiment understandable. Depending on the topic, an experiment might be:

- A toggle or parameter in the active app, compared with a retained baseline.
- A separate example or source file.
- A preserved step directory with its own configuration and run instructions.

Do not create a directory, numbered sequence, or curriculum machinery solely to satisfy this guidance. For example, use `step-1/`, `step-2/`, and `current/` only when separate runnable versions materially help learning.

## Flexible checklist

- [ ] Agree on the current experiment; keep its scope exploratory unless the user makes a requirement or decision.
- [ ] Identify the baseline or prior artifact needed for comparison.
- [ ] Make the experiment runnable and keep construction/domain state separate from experiment-specific rendering where relevant.
- [ ] Verify the active experiment and confirm preserved comparison modes or completed artifacts still work where practical.
- [ ] Update the easy-to-find idea list or learning notes when the options, status, or takeaway materially changes.
- [ ] Decide with the user what to explore next; do not infer a fixed sequence.
