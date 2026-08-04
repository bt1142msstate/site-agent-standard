# Site Agent Standard 0.1

Status: public draft.

Site Agent Standard defines a transport-neutral contract that lets an authorized
programmatic client discover what a site can answer, navigate to, and change.
It does not define natural-language interpretation, authentication, a database
schema, or a browser automation transport.

## Profiles

- **Core** defines manifests, capability identity, permissions, opaque record
  references, semantic destinations, versioning, and privacy-safe telemetry.
- **Query** defines bounded semantic reads over local or host-managed data.
- **Navigation** defines atomic UI state application and verified exact-target
  focus. A conforming implementation has no inferred DOM fallback.
- **Action** defines previewed, confirmed, idempotent site changes through the
  same authoritative domain operations used by the human interface.

Sites may claim individual profiles. Full conformance requires Query,
Navigation, and Action plus complete visible-surface and human-action coverage.

## Discovery

A public discovery manifest is available at `/site-agent.json`. Pages advertise
it without requiring an unregistered link relation:

```html
<link rel="alternate" type="application/json" href="/site-agent.json"
      data-site-agent-manifest>
```

The public document contains public capabilities only. An authenticated host
adapter may return a permission-filtered manifest for the signed-in actor.

## Normative artifacts

- `schemas/manifest.schema.json`
- `schemas/query.schema.json`
- `schemas/navigation.schema.json`
- `schemas/action.schema.json`
- `security.md`
- `conformance.md`

Normative keywords such as MUST, MUST NOT, SHOULD, and MAY are interpreted as
described by RFC 2119 and RFC 8174 when written in uppercase.
