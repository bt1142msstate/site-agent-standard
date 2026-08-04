# Contributing

## Before opening a change

1. Search existing issues and discussions.
2. For behavioral changes, open an issue describing the layout pattern and the
   smallest reproducible example.
3. Keep site-specific selectors and business rules out of the core engine.

## Development

```bash
npm install
npm run check
```

Every behavior change needs:

- a deterministic synthetic fixture that reproduces the layout;
- desktop, tablet, and touch-mobile browser coverage when geometry changes;
- unit coverage for lifecycle or visibility logic;
- accessible focus behavior and reduced-motion support;
- no runtime dependency unless the benefit cannot be achieved with browser APIs.

Pull requests should explain the problem, the root cause, the tradeoff, and the
proof used to verify the fix. Keep unrelated refactors separate.
