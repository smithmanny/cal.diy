# Cal.diy Agent Documentation Index

- **[../AGENTS.md](../AGENTS.md)** / **[../CLAUDE.md](../CLAUDE.md)** - Main guide (structure, tech stack, commands, examples)
- **[../MIGRATION.md](../MIGRATION.md)** - The move to TanStack Start + Drizzle, D1/SQLite rules, auth, teams, apps, API v2
- **[../PERMISSIONS.md](../PERMISSIONS.md)** - Roles and where permission checks live
- **[commands.md](commands.md)** - Command reference
- **[knowledge-base.md](knowledge-base.md)** - Domain knowledge and business rules
- **[rules/](rules/)** - Engineering rules (format in [rules/README.md](rules/README.md))
- **[skills/](skills/)** - Agent skills (`calcom-api` for using API v2; third-party React and UI guidelines)

## Architecture at a Glance

One TanStack Start app (`apps/web`, React 19 + Vite) with Drizzle on Cloudflare D1 or a SQLite/libSQL
file. The same build targets Cloudflare Workers (`DEPLOY_TARGET=cloudflare`) and Node/Docker.

```
apps/web/src/
  routes/            File routes. _authed/** is the signed-in app; api/v2/** is the public API
  server/<domain>/   Repository (Drizzle) → Service (business rules) → container.ts (wiring)
                     → functions.ts (createServerFn) used by pages
  server/api-v2/     API v2 auth, envelope, errors and mappers over the same services
  server/auth/       Better Auth (admin, two-factor, API keys, organizations = teams)
  server/runtime/    Workers vs Node differences, behind the #runtime alias
  components/, lib/  React components and browser-safe helpers
packages/db          Schema, migrations, drivers, D1 helpers
packages/scheduling  Slots engine
```

## Rules Index

### Architecture

- [architecture-vertical-slices](rules/architecture-vertical-slices.md) - One folder per domain in `apps/web/src/server`
- [architecture-feature-boundaries](rules/architecture-feature-boundaries.md) - Domains talk through services and containers; clients only through server functions
- [architecture-route-level-auth](rules/architecture-route-level-auth.md) - Guards in `beforeLoad`, real checks in server functions, never in a layout component
- [architecture-packages-vs-app](rules/architecture-packages-vs-app.md) - What belongs in `packages/*` vs `apps/web`
- [architecture-circular-dependencies](rules/architecture-circular-dependencies.md) - Workspace layering and container cycles

### Quality

- [quality-avoid-barrel-imports](rules/quality-avoid-barrel-imports.md) - Avoid index.ts barrel imports
- [quality-simplicity](rules/quality-simplicity.md) - Keep code simple
- [quality-no-followup-prs](rules/quality-no-followup-prs.md) - Complete work in the PR
- [quality-thorough-code-review](rules/quality-thorough-code-review.md) - Code review standards
- [quality-error-handling](rules/quality-error-handling.md) - `AppError` with translation keys
- [quality-imports](rules/quality-imports.md) - Type imports, aliases, server-only modules
- [quality-pr-creation](rules/quality-pr-creation.md) - PR best practices
- [quality-code-comments](rules/quality-code-comments.md) - Comment guidelines
- [quality-code-review](rules/quality-code-review.md) - Code review focus
- [quality-review-checklist](rules/quality-review-checklist.md) - Reviewer checklist

### Data Layer

- [data-select-only-needed-columns](rules/data-select-only-needed-columns.md) - Explicit column maps in Drizzle queries
- [data-repository-pattern](rules/data-repository-pattern.md) - Repository pattern
- [data-repository-methods](rules/data-repository-methods.md) - Repository method naming
- [data-dto-boundaries](rules/data-dto-boundaries.md) - DTO boundaries
- [data-drizzle-migrations](rules/data-drizzle-migrations.md) - Schema changes, migrations and D1 rules

### API

- [api-no-breaking-changes](rules/api-no-breaking-changes.md) - API v2 stability
- [api-thin-handlers](rules/api-thin-handlers.md) - Thin server functions and API routes

### Performance

- [performance-avoid-quadratic](rules/performance-avoid-quadratic.md) - Avoid O(n²) algorithms
- [performance-dayjs-usage](rules/performance-dayjs-usage.md) - Day.js optimization
- [performance-scheduling-complexity](rules/performance-scheduling-complexity.md) - Scheduling performance

### Testing

- [testing-coverage-requirements](rules/testing-coverage-requirements.md) - Test what you add or change
- [testing-playwright](rules/testing-playwright.md) - Playwright specs and how to run them
- [testing-mocking](rules/testing-mocking.md) - Real SQLite and fakes over mocks
- [testing-timezone](rules/testing-timezone.md) - Timezone handling (TZ=UTC)
- [testing-incremental](rules/testing-incremental.md) - Incremental test fixing

### CI/CD

- [ci-check-failures](rules/ci-check-failures.md) - Handling CI failures
- [ci-type-check-first](rules/ci-type-check-first.md) - Type-check before tests
- [ci-git-workflow](rules/ci-git-workflow.md) - Git and CI workflow

### Patterns

- [patterns-dependency-injection](rules/patterns-dependency-injection.md) - Constructor injection wired in `container.ts`
- [patterns-factory-pattern](rules/patterns-factory-pattern.md) - Factories and provider interfaces
- [patterns-app-integrations](rules/patterns-app-integrations.md) - Calendar, video and payment apps
- [patterns-background-work](rules/patterns-background-work.md) - `runInBackground` and booking listeners

### Culture

- [culture-accountability](rules/culture-accountability.md) - Engineering accountability
- [culture-leverage-ai](rules/culture-leverage-ai.md) - AI tooling practices

### Reference

- [reference-file-locations](rules/reference-file-locations.md) - Key file paths
- [reference-local-dev](rules/reference-local-dev.md) - Local development setup
