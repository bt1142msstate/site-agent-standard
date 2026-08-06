# Tutorial artifact acceptance

A tutorial artifact is accepted only when its browser, media, source identity,
and deployment evidence refer to the same completed workflow run.

## Stable source identity

Source fingerprints MUST hash stable content and origin-relative paths. JSON
object keys MUST be sorted, and generator-only timestamp fields such as
`generatedAt`, `bakedAt`, and `finalizedAt` MUST be excluded before hashing.
File modification times, directory iteration order, recording time, and build
time MUST NOT change the source fingerprint. The reference normalization ID is
`stable-content-v1`, followed by SHA-256.

## Complete media

Acceptance MUST decode the complete published video stream, not merely inspect
its container metadata. When audio is present or required, it MUST also decode
through the complete timeline. Video and required audio MUST cover the final
mapped step and their durations MUST agree within the host's declared bounded
tolerance. Stream count, file existence, or a playable first frame alone is not
acceptance evidence.

The accepted artifact MUST bind the video, step data, sanitized telemetry,
source fingerprint, presentation fingerprint, viewport, theme, actor/context
timeline, and file-integrity digests.

## Isolated deployment

Tutorial baking MUST write only to a host-declared generated-artifact directory.
The directory MUST be inside an allowlisted build root, clean before writing,
and free of symlinks that can escape that root. A baker MUST reject source
directories, repository roots, sibling deployment targets, and an existing
directory whose ownership cannot be proven. Playground and production may use
different isolated directories, but production MUST receive the same accepted
artifact bytes.

Conformance evidence uses `validateTutorialArtifactAcceptanceEvidence` and MUST
include complete decode, duration, integrity, fingerprint-normalization, and
isolated-deployment results.
