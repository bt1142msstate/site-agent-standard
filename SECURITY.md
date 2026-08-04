# Security Policy

## Supported versions

Security fixes are applied to the latest release on the default branch.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's
private vulnerability reporting for this repository. Include the affected
version, a minimal reproduction, impact, and any suggested mitigation.

Navigation adapters should never accept untrusted selectors, URLs, or actions
without application-level validation. Site Agent Standard resolves queries,
navigation, and actions only through host adapters; its Navigator profile moves focus and scroll
position; authorization and mutation safety remain the host application's
responsibility.
