# Cancellation Reason Requirement Future Work

> **Historical.** This spec describes a feature built in Cal's old Next.js + Prisma + tRPC app.
> The current app (TanStack Start + Drizzle) has not ported it: the `requiresCancellationReason`
> column and the `CancellationReasonRequirement` enum still exist in the schema (kept for data
> imported from Cal), but nothing reads them, and cancellation reasons are optional for everyone.
> The file references below are to the old code; see "Where this maps today" in `CLAUDE.md` for the
> current equivalents.

Ideas and enhancements deferred from initial implementation.

## Enhancements

- Reschedule reason requirement (same pattern, separate setting)
- Custom predefined reason options (dropdown instead of free text)
- Reason analytics dashboard

## Technical Debt

## Nice to Have

- Per-user reason requirement overrides
- Reason templates
