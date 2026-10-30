---
title: CI Check Failure Handling
impact: HIGH
impactDescription: Misinterpreting CI failures wastes debugging time
tags: ci, debugging, workflow
---

# CI Check Failure Handling

**Impact: HIGH**

## What CI runs

`.github/workflows/ci.yml` has three jobs, all on every pull request and on pushes to `main`:

| Job | Commands | Usual causes of failure |
| --- | --- | --- |
| Type check, lint and unit tests | `yarn type-check`, `yarn biome ci apps/web packages/db packages/scheduling`, `yarn test` | Type errors, Biome errors (run `yarn lint:fix`), failing Vitest tests |
| Browser tests (Node + SQLite) | `yarn e2e` | A changed label or flow the specs rely on, a missing translation key, a server error in the dev server log |
| Cloudflare Workers build | `yarn build:cf` | Node-only code outside `server/runtime/node.ts` (e.g. `node:fs`), server-only code reaching the client bundle |

Other workflows: "Validate PRs" checks the PR title is a conventional commit; the labeler and
welcome bots don't block merging.

## What to Focus On

1. **Focus on failures related to your change.** Read the failing step's log first
2. **E2E failures**: download the `playwright-traces` artifact and open the trace (`npx playwright show-trace`); re-run the spec locally with `yarn e2e <spec>`
3. **Flaky tests**: re-run once; if it fails again, treat it as real
4. **Infrastructure failures** (dependency install, runner timeouts) can be retried if every code check passed

## Before Blaming CI

Always run `yarn type-check` locally before deciding a failure is unrelated. Even errors in files you
didn't touch can come from your change through type inference or a shared type.

The Workers build only fails in CI if you never run it: `yarn build:cf` locally reproduces it.
