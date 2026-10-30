---
title: Handle NP-Hard Scheduling Problems Carefully
impact: HIGH
impactDescription: Prevents exponential blowup in scheduling operations
tags: performance, scheduling, algorithms, np-hard
---

## Handle NP-Hard Scheduling Problems Carefully

**Impact: HIGH**

Scheduling problems are NP-hard in general. As participants, constraints and time slots grow,
the work can explode. Choosing the algorithm carefully matters more here than almost anywhere else.

**Real-world implications:**
- Finding a time for every host of a collective event, across time zones, with buffers, limits, out of office and busy calendars, is expensive
- Each extra option (seats, recurring series, booking limits, rolling windows) multiplies the work
- Code that is fine for one host can be unusable for a 30-person round robin team
- On Cloudflare Workers, every request has a CPU budget; a slow slots query fails instead of just being slow

**Where this code lives:**
- `packages/scheduling` (`@calcom/scheduling`): the slots engine (`date-ranges`, `slots`, `available-slots`, `limits`, `recurring`, `out-of-office`), pure functions with their own tests
- `apps/web/src/server/bookings/BookingService.ts`: loads schedules, busy times and bookings, then calls the engine

**Strategies:**

```typescript
// Sort once, then break early: subtract() in @calcom/scheduling/date-ranges sorts the busy ranges,
// skips the ones that end before the current range and stops at the first one that starts after it
const sortedExcludedRanges = [...excludedRanges].sort((a, b) => a.start.valueOf() - b.start.valueOf());
for (const excludedRange of sortedExcludedRanges) {
  if (excludedRange.start.valueOf() >= sourceEnd.valueOf()) break;
  if (excludedRange.end.valueOf() <= currentStart.valueOf()) continue;
  // ...
}

// Bound the search: rolling windows look at most ROLLING_WINDOW_MAX_DAYS ahead
// instead of scanning until enough days are found

// One query for all hosts, returned as a Map for O(1) lookups
const lastBooked = await this.deps.bookingRepo.findLastBookedAt(eventTypeId, hostIds);
```

**Key strategies:**
- Keep the date range bounded (the booker asks for a window; never compute "all future slots")
- Merge and sort intervals once, then use linear passes, binary search or two pointers (see `performance-avoid-quadratic`)
- Batch database reads across hosts instead of querying per host or per slot
- Use `Map`/`Set` lookups keyed by user id or day instead of nested `.find`
- Measure with many hosts and long windows in a unit test before shipping a change to the engine

This is why performance isn't a nice-to-have in scheduling software: it decides whether the
booking page works for large teams at all.

Reference: [Cal.diy Engineering Blog](https://cal.com/blog/engineering-in-2026-and-beyond)
