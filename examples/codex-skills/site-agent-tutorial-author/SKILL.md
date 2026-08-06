---
name: site-agent-tutorial-author
description: Create, refresh, and verify reproducible Site Agent tutorials from a host's declared Query, Navigation, Action, and Presentation contracts. Use when a website workflow needs desktop and mobile recordings, synchronized written steps, narration or captions, privacy-safe telemetry, tutorial-impact review, or repair after mapped controls change.
---

# Site Agent Tutorial Author

Build tutorials from the host's declared capabilities and workflow map. Do not
invent selectors, routes, actions, permissions, or database writes when a host
adapter already owns them.

## Workflow

1. Locate the host's Site Agent manifest, conformance adapter, workflow map,
   tutorial manifests, and tutorial commands. Read the host documentation
   before running anything.
2. Validate the Site Agent manifest and run the host's map or capability audit.
   Treat generated control inventories as discovery data, not authority to act.
3. Identify the workflows affected by the requested product change. Report an
   explicit `updated`, `added`, or `none` tutorial decision with evidence.
4. Use local fixtures or an isolated Playground environment. Never record real
   private production data. Never perform production writes for a tutorial.
5. Exercise the mapped workflow once without recording. Assert resulting state,
   permissions, cleanup, and exact Navigation destinations before presentation
   work begins.
6. Record desktop and mobile as independent runs. A resized desktop recording
   is not a mobile tutorial. Use the host's Site Agent Presentation adapter for
   pointer travel, settled scrolling, target framing, click feedback, visible
   typing, and optional sound.
7. Keep instructions and narration sourced from the reviewed workflow. Prefer
   one continuous narration track, measured word timings, optional captions,
   and a mute control. Do not narrate fixture, selector, emulator, cleanup, or
   other implementation details.
8. Review every artifact: video, screenshots, written steps, target visibility,
   pointer anchoring, audio timing, captions, console errors, telemetry, and
   cleanup. Verify mouse, keyboard, touch, reduced motion, and muted playback.
9. Bake only a matching accepted desktop/mobile pair. Reject stale source or
   presentation fingerprints, blocking telemetry, mixed recording batches, or
   missing integrity metadata.
10. Run the host's tutorial, Site Agent conformance, responsive browser, and
    release gates. When separately authorized, promote the exact verified
    Playground artifact only through the host's normal release process.

## Hard Requirements

- Host authentication, authorization, validation, and Action handlers remain
  authoritative.
- State-changing tutorials use run-scoped synthetic records and exact cleanup
  that also runs after failure.
- Each action proves its result; a successful click alone is not evidence.
- Navigation proves complete state, smallest exact visible target, stable
  geometry, and unobstructed hit testing.
- Telemetry contains capability IDs, timings, retries, result classes, and
  sanitized errors only. Exclude prompts, record contents, personal data,
  credentials, selectors, storage paths, and auth state.
- Ordinary automation stays fast and silent. Instructional motion and sound are
  enabled only for tutorial presentation.

## Completion Report

Report the affected workflow IDs, environments, desktop/mobile artifacts,
checks run, cleanup result, tutorial-impact decision, and whether anything was
deployed. Name any workflow that could not be recorded and the concrete reason.
