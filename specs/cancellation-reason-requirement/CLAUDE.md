# CLAUDE.md — Cancellation Reason Requirement

> **Historical.** This feature was built in Cal's old Next.js + Prisma + tRPC app and has not been
> ported to the current TanStack Start + Drizzle app. Cancellation reasons are currently optional for
> hosts and attendees. If you are asked to (re)implement it, treat `design.md` as the product spec and
> use the current locations below, not the old paths in the other files.

## Project Context

A setting in Event Type Advanced settings to configure when cancellation reasons are required
(mandatory for both, host only, attendee only, or optional).

## Where this maps today

| Old code | Current equivalent |
| --- | --- |
| `packages/prisma/schema.prisma` enum and column | Already in `packages/db/src/schema.ts` (`eventType.requiresCancellationReason`, text, default `MANDATORY_HOST_ONLY`) and `packages/db/src/enums.ts` (`CancellationReasonRequirement`); no migration needed |
| `packages/prisma/zod-utils.ts` metadata schema | Event type input schemas in `apps/web/src/server/event-types/types.ts` |
| `EventAdvancedTab.tsx`, `RequiresConfirmationController` | `apps/web/src/components/event-types/AdvancedEditor.tsx` (see its requires-confirmation setting) |
| `getEventTypesFromDB` (`apps/web/lib/booking.ts`) | `BookingService.getBooking` and `BookingRepository.findByUid` (`apps/web/src/server/bookings/`) |
| `packages/features/bookings/lib/handleCancelBooking.ts` | `BookingService.cancel` (by uid), `cancelAsHost` and `cancelSeat` in `apps/web/src/server/bookings/BookingService.ts`, called from `cancelBookingByUid` / `cancelBookingAsHost` in `bookings/functions.ts` and from `ApiBookingService.cancel` (API v2) |
| `CancelBooking.tsx`, `CancelBookingDialog.tsx`, `bookings-single-view.tsx` | Attendee cancel form in `apps/web/src/routes/booking/$uid.tsx`; host cancel in `apps/web/src/routes/_authed/bookings/$status.tsx` |
| Translations | `packages/i18n/locales/en/common.json`, plus the route's `MESSAGE_KEYS` |

## Before Starting Work

1. Read specs/cancellation-reason-requirement/design.md
2. Check specs/cancellation-reason-requirement/implementation.md (its "complete" status refers to the old app)
3. Look at the current files in the table above

## Code Patterns

- Validate on the server in `BookingService`, throwing `AppError` with a translation key; the UI check is only for convenience
- Follow the requires-confirmation setting in `AdvancedEditor.tsx` for the settings UI
- Follow existing translation patterns

## Don't

- Don't add features not in design.md
- Don't skip tests
- Don't modify reschedule reason behavior (out of scope)
