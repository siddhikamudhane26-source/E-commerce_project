---
name: OpenAPI codegen naming
description: Non-obvious Orval naming behavior encountered while defining the commerce API.
---

When an operation combines a path parameter with a query parameter, Orval can emit the same `*Params` name from both the generated Zod API module and the generated types module, causing a barrel export collision. Keep the contract free of that combination when practical, or rename the API shape deliberately after checking the generated exports.

**Why:** The collision is downstream of successful code generation, so it looks like a workspace typecheck failure rather than an OpenAPI validation error.

**How to apply:** After every meaningful OpenAPI change, run codegen and inspect the generated export names before wiring routes or frontend hooks.