---
title: PR Creation Best Practices
impact: HIGH
impactDescription: PRs that don't follow guidelines slow down review cycles
tags: pull-request, code-review, workflow
---

# PR Creation Best Practices

**Impact: HIGH**

## Draft Mode

Create pull requests in draft mode by default, so that a human reviewer can mark it as ready for
review only when it is.

## PR Title

- Use conventional commits: `feat:`, `fix:`, `refactor:` (checked by the "Validate PRs" workflow)
- Be specific: `fix: handle timezone edge case in booking creation`
- Not generic: `fix: booking bug`

## Size Limits

- **Large PRs** (>500 lines or >10 code files) are not recommended
- Split large changes by layer (schema and migration, server, UI)
- Split by feature component (service and server functions, UI, API v2)

## What CI runs

`.github/workflows/ci.yml` runs on every PR:
- **Type check, lint and unit tests**: `yarn type-check`, `yarn biome ci apps/web packages/db packages/scheduling`, `yarn test`
- **Browser tests**: `yarn e2e` on Node + SQLite with fake third-party servers
- **Cloudflare Workers build**: `yarn build:cf`

## Before Pushing

1. `yarn type-check`
2. `yarn lint:fix`
3. Run the relevant tests: `yarn test`, and the e2e specs your change touches (`yarn e2e <spec>`)
