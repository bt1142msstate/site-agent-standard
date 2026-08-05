# Presentation profile

The optional Presentation profile gives deterministic automation an accessible,
instructional rendering mode without forcing visible behavior on background
agents. A claiming manifest MUST provide a `presentation` declaration and MUST
support muting and reduced motion.

The reference preset provides a high-contrast stemless pointer, visible travel
to the exact target, a brief target pause, target outline, click ripple, smooth
framing, visible typing, and local click and typing sound cues. Hosts MAY replace
the artwork and sound theme while preserving the declared semantics.

Presentation is disabled unless a host creates and invokes a presentation
controller. Query, Navigation, and Action behavior MUST remain correct when the
profile is absent, muted, or running with reduced motion.

## Required sequence

For an instructional click, the pointer MUST travel from its prior location to
the exact target, pause, and then display click feedback. The pointer hotspot
MUST remain anchored to the ripple center throughout the click animation.

Visible typing MUST emit ordinary input and change events. It MUST NOT bypass
the site's validation or authoritative Action handler. Sounds MUST be locally
generated or host-provided, muted by default in general automation, and MUST
never contain record data.

## Conformance

A Presentation-conformant browser implementation proves the sequence at
desktop and touch-mobile viewports, including nested scrolling, sticky headers,
delayed targets, reduced motion, mute, target replacement, and cleanup. A
tutorial is conformant only when its workflow capabilities also conform to the
profiles they invoke.
