# Browser binding

The browser binding discovers `/site-agent.json` through the page's
`data-site-agent-manifest` link. A host creates adapters for Query, Navigation,
and Action. The manifest never supplies executable selectors or arbitrary
scripts.

Navigation adapters activate the application view, apply every requested state
value, wait for data, verify the complete state, and resolve one exact target.
The Site Navigator reference runtime then performs geometry, clipping, hit-test,
focus, and highlight verification.
