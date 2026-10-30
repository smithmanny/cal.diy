# Cancellation Reason Requirement Documentation

> **Historical.** This spec describes a feature built in Cal's old Next.js + Prisma + tRPC app.
> The current app (TanStack Start + Drizzle) has not ported it: the `requiresCancellationReason`
> column and the `CancellationReasonRequirement` enum still exist in the schema (kept for data
> imported from Cal), but nothing reads them, and cancellation reasons are optional for everyone.
> The file references below are to the old code; see "Where this maps today" in `CLAUDE.md` for the
> current equivalents.

## Overview

This feature allows event type owners to configure when cancellation reasons are required.

## Screenshots

Screenshots will be added here once the feature is implemented.

## Configuration

The setting is located in Event Type → Advanced Settings, after the Booking Questions section.

### Options

- **Mandatory for both**: Both host and attendee must provide a reason when cancelling
- **Mandatory for host only** (default): Only the host must provide a reason
- **Mandatory for attendee only**: Only the attendee must provide a reason
- **Optional for both**: Cancellation reason is optional for everyone
