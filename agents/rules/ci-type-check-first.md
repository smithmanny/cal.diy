---
title: Type Check Before Tests
impact: HIGH
impactDescription: Type errors are often the root cause of test failures
tags: ci, typescript, type-check, workflow
---

# Type Check Before Tests

## Priority Order

Fix type errors before failing tests.

1. `yarn type-check` (runs `tsc --noEmit` in `@calcom/web`, `@calcom/db` and `@calcom/scheduling`)
2. Fix all TypeScript errors
3. Then `yarn test`

## Why Type Check First

Type errors are often the root cause of test failures. Fixing them first:
- Eliminates cascading failures
- Makes sure the code compiles for both runtimes
- Catches issues tests might miss

## Comparing Branches

To confirm whether you introduced new type errors, compare with `main`:

```bash
# On your branch
yarn type-check 2>&1 | tee /tmp/feature-types.log

# On main
git checkout main
yarn type-check 2>&1 | tee /tmp/main-types.log

# Compare
diff /tmp/main-types.log /tmp/feature-types.log
```

## Common Causes

- **Stale route types**: errors about unknown routes in `createFileRoute("...")` or `Link to=...` mean `routeTree.gen.ts` is out of date; restart `yarn dev` to regenerate it
- **Schema changes**: Drizzle types come straight from `packages/db/src/schema.ts`, so there is no generate step; a column error means the schema and the code disagree
- **Workers bindings**: `Cloudflare.Env` is declared by hand in `apps/web/src/env.d.ts`; update it when you add a binding to `wrangler.jsonc`
- **`#runtime`**: type checking resolves it to `server/runtime/node.ts`, so keep `cloudflare.ts` exporting the same names with compatible types
