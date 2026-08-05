# Presentation profile

The optional Presentation profile gives deterministic automation an accessible,
instructional rendering mode without forcing visible behavior on background
agents. A claiming manifest MUST provide a `presentation` declaration and MUST
support muting and reduced motion.

The reference `standard-instructional-v2` preset provides a crisp white pointer,
visible travel to the exact target, a brief target pause, target outline,
hotspot-anchored click ripple, eased nested scrolling, sticky-header-aware
framing, visible typing, and local tactile click and mobile-keyboard sound cues.
The reference browser runtime and offline audio API MUST derive those sound cues
from the same deterministic profiles. Hosts MAY replace the artwork and sound
theme while preserving the declared semantics.

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

An implementation MAY expose the reference preset as a one-step tutorial mode,
but MUST NOT enable visible or audible effects merely because Query, Navigation,
or Action is active. Disabling sound MUST NOT alter event timing, and a failed or
blocked browser audio context MUST NOT prevent the underlying operation.

## Conformance

A Presentation-conformant browser implementation proves the sequence at
desktop and touch-mobile viewports, including nested scrolling, sticky headers,
delayed targets, reduced motion, mute, target replacement, and cleanup. A
tutorial is conformant only when its workflow capabilities also conform to the
profiles they invoke.
