# Certification coach: learning-focus drift

## Purpose

In another repository, review and update the Certification Learning Coach's configuration so it actively keeps the learner grounded in GH-600 (or the current learning objective) when a real project example draws the conversation into product discovery or specification. This is a proposed configuration improvement, not an instruction to change that other repository without its normal review.

## What happened

- The learner wanted to understand how issue #8 and the project's Ada agent fit into their way of working, as part of learning issues, pull requests, and agent workflows for GH-600.
- The coach inspected the issue and project context, but then asked a sequence of questions about endpoint snapping, selection, and connected walls. The exchange became product specification rather than an explanation of the workflow.
- The learner explained that they naturally explore and design as an engineer and need the coach to help them stay focused. They clarified that the drift began at product speculation, not merely at implementation or delivery.
- No issue or project files were changed. The ideas discussed were exploration, not an approved specification or project decision.

## Desired behavior

Real repository examples should remain useful teaching material. The coach should notice when a discussion shifts from understanding the certification concept into deciding how the product should work, briefly name the drift, and guide the learner back to the learning objective. It should not continue asking product-design questions under the guise of using an example. Keep the interaction natural and avoid turning the guardrail into a rigid curriculum or repetitive interruption.

The learner can use an appropriate engineering agent, such as Ada, in a separate context for product discovery. The coach can explain what that agent's workflow does and where an issue, human decisions, branch, and pull request fit, without conducting the product discovery itself.

## Evidence and configuration gap

The [current coach definition](../../.github/agents/certification-learning-coach.agent.md) encourages following the learner's curiosity and connecting to real projects; it limits changes outside `training/`, but does not explicitly address drift into product specification during conversation. Its instruction to return to the original topic “when useful” did not prevent this failure. This is an observed failure and a plausible instruction gap, not proof that a wording change alone will fix it.

The [progress memory](../PROGRESS.md) records the current GH-600 focus as issues, branches, pull requests, and agents. The coach did not consult it before starting this discussion. The [Ada definition](../../.github/agents/ada.agent.md) describes a collaborative engineering discovery and handoff role, distinct from the coach's tutoring role.

## Suggested validation in the target host

Use a realistic conversation where the learner asks how a real issue relates to an engineering agent and GH-600, then starts discussing a product behavior. Check that the coach recognizes the shift into specification, redirects toward the learning objective, and does not ask the next product-design question. Also check that it can still use brief concrete project examples, follow legitimate certification questions, and support learner-approved experiments within its existing learning-lab boundary. Review actual host behavior; instructions alone do not guarantee it.

These relative links identify evidence in the source repository. If transferring this note to a different repository, supply the relevant files or accessible links separately; do not assume the receiving agent can read this checkout or its chat history.
