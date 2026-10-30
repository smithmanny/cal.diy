# Cal.diy Development Guide for AI Agents

You are a senior Cal.diy engineer working in a Yarn workspaces monorepo (TanStack Start + Drizzle on Cloudflare D1 or SQLite). You prioritize type safety, security, and small, reviewable diffs.

## Do

- Select only the columns you need in Drizzle queries (`db.select({ ... })`), never whole rows with secrets
- Use `import type { X }` for TypeScript type imports
- Use early returns to reduce nesting: `if (!booking) return null;`
- Throw `AppError(code, status, values)` (`apps/web/src/server/errors.ts`) with a translation key as the code
- Use conventional commits: `feat:`, `fix:`, `refactor:`
- Create PRs in draft mode by default
- Run `yarn type-check` before concluding CI failures are unrelated to your changes
- Import directly from source files, not barrel files (e.g., `@coss/ui/components/button`)
- Add translations to `packages/i18n/locales/en/common.json` for all UI strings
- Use `date-fns` or native `Date` instead of Day.js when timezone awareness isn't needed
- Put permission checks in the route's `beforeLoad` or the server function, never in a layout
- Use `ast-grep` for searching if available; otherwise use `rg` (ripgrep), then fall back to `grep`
- Use Biome for formatting and linting
- Only add code comments that explain **why**, not **what** — see [code comment guidelines](agents/rules/quality-code-comments.md)


## Don't

- Never use `as any` - use proper type-safe solutions instead
- Never expose `credential.key` field in API responses or queries
- Never commit secrets or API keys
- Never modify `routeTree.gen.ts` directly - TanStack Router generates it
- Never put business logic in repositories - that belongs in Services
- Never use barrel imports from index.ts files
- Never skip running type checks before pushing
- Never create large PRs (>500 lines or >10 files) - split them instead
- Never add comments that simply restate what the code does (e.g., `// Get the user` above a `getUser()` call)

## PR Size Guidelines

Large PRs are difficult to review, prone to errors, and slow down the development process. Always aim for smaller, self-contained PRs that are easier to understand and review.

### Size Limits

- **Lines changed**: Keep PRs under 500 lines of code (additions + deletions)
- **Files changed**: Keep PRs under 10 code files
- **Single responsibility**: Each PR should do one thing well

**Note**: These limits apply to code files only. Non-code files like documentation (README.md, CHANGELOG.md), lock files (yarn.lock, package-lock.json), and auto-generated files are excluded from the count.

### How to Split Large Changes

When a task requires extensive changes, break it into multiple PRs:

1. **By layer**: Separate database/schema changes, backend logic, and frontend UI into different PRs
2. **By feature component**: Split a feature into its constituent parts (e.g., API endpoint PR, then UI PR, then integration PR)
3. **By refactor vs feature**: Do preparatory refactoring in a separate PR before adding new functionality
4. **By dependency order**: Create PRs in the order they can be merged (base infrastructure first, then features that depend on it)

### Examples of Good PR Splits

**Instead of one large "Add booking notifications" PR:**
- PR 1: Add notification preferences schema and migration
- PR 2: Add notification service and API endpoints
- PR 3: Add notification UI components
- PR 4: Integrate notifications into booking flow

**Instead of one large "Refactor calendar sync" PR:**
- PR 1: Extract calendar sync logic into dedicated service
- PR 2: Add new calendar provider abstraction
- PR 3: Migrate existing providers to new abstraction
- PR 4: Add new calendar provider support

### Benefits of Smaller PRs

- Faster review cycles and quicker feedback
- Easier to identify and fix issues
- Lower risk of merge conflicts
- Simpler to revert if problems arise
- Better git history and easier debugging

## Commands

Key commands (from the repo root):

```bash
yarn dev                    # Node + local SQLite file on :3000
yarn dev:cf                 # Cloudflare Workers runtime (Miniflare + local D1)
yarn type-check             # Type check (always run before pushing)
yarn lint:fix               # Biome lint and format
yarn test                   # Unit tests (TZ=UTC)
yarn e2e                    # Playwright browser tests against a throwaway database
yarn db:generate            # Generate a Drizzle migration after editing packages/db/src/schema.ts
```


## Boundaries

### Always do
- Run type check on changed files before committing
- Run relevant tests before pushing
- Select only the columns you need in Drizzle queries
- Follow conventional commits for PR titles
- Run Biome before pushing

### Ask first
- Adding new dependencies
- Schema changes to `packages/db/src/schema.ts` (they need a migration that works on D1)
- Changes affecting multiple packages
- Deleting files
- Running full build or E2E suites

### Never do
- Commit secrets, API keys, or `.env` files
- Expose `credential.key` in any query
- Use `as any` type casting
- Force push or rebase shared branches
- Modify generated files directly

## Project Structure

```
apps/web/                    # TanStack Start app (pages, server functions, API v2, auth)
  src/routes/                # File-based routes; src/routes/api/v2 is the public API
  src/server/<domain>/       # Repositories, services and server functions per domain
  src/components/            # React components
  e2e/                       # Playwright specs and fake third-party servers
packages/db/                 # Drizzle schema, migrations, D1 and libSQL drivers
packages/scheduling/         # Slots engine (date ranges, limits, recurring)
packages/coss-ui/            # UI components (@coss/ui)
packages/i18n/               # Translations
packages/embeds/embed-core/  # Embed snippet library, built into apps/web/public/embed
```

### Key files
- Database schema: `packages/db/src/schema.ts` (migrations in `packages/db/migrations`)
- Auth: `apps/web/src/server/auth/createAuth.ts` (Better Auth, with the organization, admin, 2FA and API key plugins)
- Runtime differences (Workers vs Node): `apps/web/src/server/runtime/`
- Translations: `packages/i18n/locales/en/common.json`
- Migration notes and D1 rules: `MIGRATION.md`

## Tech Stack

- **Framework**: TanStack Start (React 19, Vite)
- **Language**: TypeScript (strict)
- **Database**: Drizzle ORM on Cloudflare D1 or a local SQLite/libSQL file
- **API**: TanStack Start server functions (internal), server routes under `/api/v2` (public)
- **Auth**: Better Auth
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest (unit), Playwright (E2E)
- **Hosting**: Cloudflare Workers, or Docker (Node) on any machine including a Raspberry Pi

## Code Examples

### Good error handling

```typescript
// Good - Descriptive error with context
throw new Error(`Unable to create booking: User ${userId} has no available time slots for ${date}`);

// Bad - Generic error
throw new Error("Booking failed");
```

### Good Drizzle query

```typescript
// Good - Only the columns the caller needs
const [found] = await db
  .select({ id: booking.id, title: booking.title, userId: booking.userId })
  .from(booking)
  .where(eq(booking.uid, uid))
  .limit(1);

// Bad - Whole rows, including columns the caller shouldn't see
const [found] = await db.select().from(credential).where(eq(credential.userId, userId));
```

D1 has no interactive transactions: write atomically with `db.batch([...])`. See `MIGRATION.md`
for the other SQLite/D1 rules.

### Good imports

```typescript
// Good - Type imports and direct paths
import type { Database } from "@calcom/db/database";
import { Button } from "@coss/ui/components/button";

// Bad - Regular import for types
import { Database } from "@calcom/db/database";
```

## PR Checklist

- [ ] Title follows conventional commits: `feat(scope): description`
- [ ] Type check passes: `yarn type-check`
- [ ] Lint passes: `yarn lint:fix`
- [ ] Relevant tests pass
- [ ] Diff is small and focused (<500 lines, <10 files)
- [ ] No secrets or API keys committed
- [ ] UI strings added to translation files
- [ ] Created as draft PR

## When Stuck

- Ask a clarifying question before making large speculative changes
- Propose a short plan for complex tasks
- Open a draft PR with notes if unsure about approach
- Fix type errors before test failures - they're often the root cause
- Restart `yarn dev` if TanStack Router reports unknown routes; it regenerates `routeTree.gen.ts`

## Spec-Driven Development (Opt-In)

For complex features, you can use spec-driven development when explicitly requested.

**To enable:** Tell the AI "use spec-driven development" or "follow the spec workflow"

See [SPEC-WORKFLOW.md](SPEC-WORKFLOW.md) for the full workflow documentation.

## Extended Documentation

For detailed information, see the `agents/` directory:

- **[agents/README.md](agents/README.md)** - Rules index and architecture overview
- **[agents/rules/](agents/rules/)** - Modular engineering rules
- **[agents/commands.md](agents/commands.md)** - Complete command reference
- **[agents/knowledge-base.md](agents/knowledge-base.md)** - Domain knowledge and business rules
