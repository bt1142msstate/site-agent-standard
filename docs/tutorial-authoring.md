# Authoring tutorials with Site Agent Standard

Status: non-normative implementation guidance for Site Agent Standard 0.2.

Site Agent Standard can drive deterministic automation and instructional
tutorials through the same semantic capabilities. The recommended design does
not record an unrelated macro and does not give a model raw selectors. It adds
a workflow and recording layer above the host's conforming Query, Navigation,
Action, and Presentation adapters.

## Responsibility split

| Layer | Responsibility |
| --- | --- |
| Site Agent manifest | Stable capability, resource, destination, permission, and presentation IDs |
| Host adapters | Authentication, authorization, data access, UI state, exact targets, and authoritative writes |
| Workflow map | Reviewed action sequence, assertions, instructions, narration, fixtures, and cleanup |
| Tutorial runner | Isolated execution, desktop/mobile recording, screenshots, timing, and sanitized telemetry |
| Presentation adapter | Pointer travel, scrolling, framing, target outline, ripple, visible typing, and optional sound |
| Media pipeline | Narration, word alignment, captions, audio mixing, integrity metadata, and final video |
| Tutorial viewer | Responsive video, written steps, step seeking, viewport choice, captions, mute, and sharing |

The runner also owns a complete rendered-quality matrix. At every mapped state,
viewport, and supported theme, it checks visible labels and contrast from real
browser computed styles. Accessibility-tree labels and source CSS are useful
inputs but are not substitutes for rendered evidence.

The workflow map is deliberately separate from the standard manifest. A
capability states what can be queried, shown, or changed; a workflow states the
ordered teaching sequence for one user outcome. Business logic stays in the
host adapters and domain handlers.

## Recommended workflow contract

A host-specific workflow should identify capabilities rather than duplicate
their implementation:

```json
{
  "id": "orders.review-open-order",
  "title": "Review an open order",
  "role": "manager",
  "tutorialSafe": true,
  "steps": [
    {
      "capabilityId": "orders.query.open",
      "instruction": "Open the current orders list.",
      "narration": "First, open the current orders list."
    },
    {
      "capabilityId": "orders.navigation.total",
      "instruction": "Review the order total.",
      "narration": "The total appears here."
    }
  ],
  "assertions": ["orders.navigation.total is exact and visible"]
}
```

Write tutorials need additional host-owned fixture, confirmation, idempotency,
result, audit, and cleanup declarations. Do not put credentials, database paths,
private record IDs, or selectors in a public manifest or model-visible workflow.

## Generation flow

1. **Audit impact.** Compare the product change with capability IDs, workflow
   steps, destinations, responsive controls, narration, and presentation. Mark
   each affected tutorial `added`, `updated`, or `none`.
2. **Validate contracts.** Run manifest conformance and the host's interaction
   map audit before recording. An unmapped visible control is a host-coverage
   issue, not permission for an agent to infer a selector.
3. **Use an isolated environment.** Prefer local fixtures. Use a separate
   Playground when authentication, roles, or backend behavior must be real.
   Never record private production records or perform tutorial writes there.
4. **Prove the workflow first.** Run it without recording and assert the final
   UI and backend state. For writes, use run-scoped synthetic data and exact
   cleanup in a failure-safe path.
5. **Record two variants.** Record desktop and touch-mobile independently.
   Responsive layouts can expose different menus, dialogs, and framing. The
   viewer may select a default by viewport but must allow an accessible manual
   switch.
6. **Enable Presentation only for teaching.** Use the standard instructional
   preset or a conforming host theme. The pointer travels to the target, pauses,
   and remains anchored during the ripple. Scrolling settles before the pointer
   moves. Ordinary automation remains fast, silent, and presentation-free.
7. **Build accessible media.** Keep written steps outside the video. Make each
   step keyboard-, touch-, and screen-reader-operable and seekable to its exact
   start time. Narration is optional; when present, use captions and a mute
   control. Captions should not cover demonstrated controls.
8. **Validate artifacts.** Inspect real video and screenshots, not only unit
   tests. Reject console errors, failed requests, clipped targets, stale source
   fingerprints, mismatched desktop/mobile batches, invalid cleanup, or missing
   integrity metadata.
9. **Bake and release.** Publish only the accepted pair into an exact Playground
   artifact, run hosted conformance and role checks, then promote that same
   artifact through the host's normal release path when separately authorized.

For multi-actor workflows, declare actors plus client and Operations contexts in
the workflow. Record them on one shared monotonic timeline with step barriers;
do not splice together unrelated one-client recordings. Normalize source
fingerprints before hashing so generated timestamps cannot invalidate otherwise
identical artifacts. Acceptance must fully decode video and required audio and
must bake only into a clean, symlink-free generated-artifact directory.

## Recommended local narration pipeline

The standard does not require a narrator or speech model. A high-quality local
implementation can keep browser recordings independent from narration so a
voice can be replaced without re-recording the site:

1. Compile conversational narration from reviewed workflow text.
2. Synthesize one continuous audio track per tutorial and viewport.
3. Measure word boundaries with a local forced aligner.
4. Place actions shortly after the final aligned word for each step.
5. Mix click and typing cues from recorded interaction timestamps.
6. Store caption words and step start times separately from the video.
7. Cache by model, voice, script, aligner, and presentation identities.

This avoids clipped per-step speech, estimated caption drift, and unnecessary
browser re-recording. Narration and telemetry should remain local when a
tutorial can contain authenticated or non-public screens.

## Reusable Codex skill

This repository includes a host-neutral example at
[`examples/codex-skills/site-agent-tutorial-author`](../examples/codex-skills/site-agent-tutorial-author/SKILL.md).
Copy the whole folder into a Codex skills directory:

```sh
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R examples/codex-skills/site-agent-tutorial-author \
  "${CODEX_HOME:-$HOME/.codex}/skills/"
```

The skill intentionally discovers and uses the host's commands instead of
assuming one framework or repository layout.

### Exact reusable prompt

Replace the bracketed values, then use this prompt verbatim:

```text
Use $site-agent-tutorial-author.

In [absolute repository path], refresh and verify the tutorials for these Site
Agent workflows: [workflow IDs, or "all workflows affected by this change:
change summary"]. Use the host's declared capabilities and existing tutorial
runner. Do not invent selectors, routes, permissions, or write handlers.

Run writes only with run-scoped synthetic records in the host's local or
Playground environment, verify resulting state, and perform exact cleanup even
after failure. Never record private production data or perform production
writes. Record and review independent desktop and touch-mobile variants using
the host's Site Agent Presentation adapter. Preserve accessible written steps,
step seeking, optional captions, mute and reduced-motion behavior, and sanitized
telemetry. Run the host's Site Agent, tutorial, responsive browser, and release
gates. Report the tutorial-impact decision and every generated artifact. Do not
deploy production unless this request separately authorizes it.
```

The shorter default prompt installed with the skill is:

```text
Use $site-agent-tutorial-author to record and verify desktop and mobile tutorials for the affected Site Agent workflows.
```

There is no hidden tutorial-generation prompt in the standard. The Codex prompt
selects the skill; the host's reviewed workflow text supplies instructions and
narration. This keeps tutorial language, automation, and capability IDs from
drifting into separate model-authored copies.

## Acceptance checklist

- Manifest and host workflow map validate.
- Every demonstrated control maps to a declared capability.
- Read, write, confirmation, denial, and cleanup behavior use authoritative
  host adapters.
- Desktop and touch-mobile are separately recorded and reviewed.
- The exact target is visible and unobstructed at every action.
- Every mapped state passes computed-style visible-label and contrast checks in
  every declared viewport and theme.
- Pointer hotspot, target outline, ripple, scrolling, typing, and sound remain
  synchronized when Presentation is enabled.
- Written steps work without audio; captions and mute are accessible.
- No personal data, credentials, selectors, prompts, or record contents enter
  telemetry or public discovery.
- Artifacts bind source and presentation fingerprints plus file integrity.
- Source fingerprints ignore generator-only timestamps, media fully decodes
  through the mapped timeline, and deployment output is isolated.
- The exact accepted pair passes hosted checks before release.
