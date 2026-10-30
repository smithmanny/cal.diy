---
title: Day.js Performance Guidelines
impact: HIGH
impactDescription: Significant performance improvement in date-heavy operations
tags: performance, dates, dayjs
---

## Day.js Performance Guidelines

**Impact: HIGH (Significant performance improvement in date-heavy operations)**

`@calcom/dayjs` (`packages/dayjs`) loads every plugin, including time zones and locales, and its
time-zone operations are slow. Use it where you need strict time-zone math (the slots engine in
`packages/scheduling`, availability), and native `Date` / `Intl` everywhere else.

**Incorrect (Day.js where it isn't needed):**

```typescript
// Slow in loops
dates.map((date) => dayjs(date).add(1, "day").format());

// Day.js for a simple comparison
if (dayjs(booking.endTime).isBefore(dayjs())) { ... }
```

**Correct (cheaper alternatives):**

```typescript
// UTC mode when the time zone doesn't matter
dates.map((date) => dayjs.utc(date).add(1, "day").format());

// Native Date and millisecond comparisons, with the helpers in apps/web/src/lib/date-utils.ts
dates.map((date) => new Date(date.getTime() + 24 * 60 * 60 * 1000));
const day = { start: utcStartOfDay(holiday.date), end: utcEndOfDay(holiday.date) };
const key = dateKeyInTimeZone(link.expiresAt, timeZone); // "YYYY-MM-DD" via Intl
if (found.endTime <= new Date()) throw new AppError("booking_has_ended", 409);

// Intl for display, with the locale from the route context
const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
```

Dates from the database are already `Date` objects (columns are `timestamp_ms`), so compare them
with `<`, `<=` or `.getTime()`.

Don't add `date-fns`: native `Date` and `Intl` cover what Day.js isn't needed for. Add a helper to
`date-utils.ts` (with a test) when the same arithmetic shows up twice. Remember that native `Date`
methods without `UTC` in the name use the server's local time zone; use the `getUTC*`/`setUTC*`
methods or `Intl.DateTimeFormat` with an explicit `timeZone`.

**When to use Day.js:**
- Strict time-zone awareness (slots, availability, the booker)
- Complex time-zone conversions
- One-off operations where the cost doesn't matter

**When to avoid Day.js:**
- Simple date arithmetic and comparisons
- Formatting without time-zone conversion
- Hot loops over dates

Reference: [Cal.diy Engineering Standards](https://cal.com/blog/engineering-in-2026-and-beyond)
