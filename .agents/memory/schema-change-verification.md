---
name: Schema-change verification
description: Development database schema changes must be applied before runtime verification.
---

Apply the development Drizzle schema before restarting a service that selects newly added columns.

**Why:** The API can build successfully while startup fails when the live development database still has the previous schema.

**How to apply:** After schema edits, run the workspace database push, then restart the dependent workflow and exercise one read and one mutation endpoint.