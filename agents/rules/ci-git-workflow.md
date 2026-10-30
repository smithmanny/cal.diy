---
title: Git and CI Workflow
impact: HIGH
impactDescription: Incorrect workflow causes wasted CI cycles and confusion
tags: git, ci, workflow
---

# Git and CI Workflow

## Push Before Checking CI

Push committed changes before waiting for or checking CI. CI runs on the remote branch, not your
local commits.

**Proper sequence:**
1. Commit locally
2. Run local checks: `yarn type-check`, `yarn lint:fix`, relevant tests
3. Push to remote
4. Monitor CI status

A pre-commit hook (husky + lint-staged) runs Biome lint on staged files; fix what it reports rather
than skipping it.

## Branch Operations

When asked to move changes to a different branch, commit the existing changes to that branch with
git rather than redoing the work.

## Never Force Push

**Never force push to main or shared branches**, and don't rebase branches other people work on.

## After Pulling Changes

1. `yarn install` if `yarn.lock` changed
2. Migrations apply themselves when `yarn dev` starts; for `yarn dev:cf`, run `yarn db:migrate:d1:local`
3. Restart `yarn dev` if TanStack Router reports unknown routes; it regenerates `apps/web/src/routeTree.gen.ts`
4. `yarn type-check` before you start changing code
