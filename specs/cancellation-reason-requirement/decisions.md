# Cancellation Reason Requirement Decisions

> **Historical.** This spec describes a feature built in Cal's old Next.js + Prisma + tRPC app.
> The current app (TanStack Start + Drizzle) has not ported it: the `requiresCancellationReason`
> column and the `CancellationReasonRequirement` enum still exist in the schema (kept for data
> imported from Cal), but nothing reads them, and cancellation reasons are optional for everyone.
> The file references below are to the old code; see "Where this maps today" in `CLAUDE.md` for the
> current equivalents.

## ADR-001: Store in Database Column vs Metadata JSON

### Context

Need to store the cancellation reason requirement setting on EventType.

### Options Considered

1. **New database column with enum** — Requires migration, type-safe, cleaner queries
2. **Metadata JSON field** — No migration, but less type-safe for a core setting

### Decision

Use a dedicated database column with an enum (`CancellationReasonRequirement`; then a Prisma enum, now TEXT in `packages/db/src/schema.ts` with values from `packages/db/src/enums.ts`).

Rationale:
- This is a core booking flow setting, similar to `disableCancelling` and `requiresConfirmation`
- Type-safe at the database level
- Cleaner to query in cancellation validation logic
- Consistent with how similar settings (`disableCancelling`, `disableRescheduling`) are stored

### Consequences

- Requires database migration
- Type-safe enum values
- Direct column access in queries (no JSON parsing)
