---
title: Repository Method Naming Conventions
impact: HIGH
impactDescription: Improves code discoverability and reusability
tags: data, repository, naming, conventions, methods
---

## Repository Method Naming Conventions

**Impact: HIGH**

Repository methods follow consistent names so they are easy to find and reuse.

### Rule 1: Don't repeat the entity name

The class name already says what the entity is.

```typescript
// Good - from WebhookRepository
class WebhookRepository {
  findManyByUserId(userId: number) { ... }
  findById(id: string) { ... }
  findByUserIdAndUrl(userId: number, subscriberUrl: string) { ... }
  create(data: typeof webhook.$inferInsert) { ... }
  update(id: string, data: Partial<typeof webhook.$inferInsert>) { ... }
  deleteById(id: string) { ... }
}

// Bad - redundant entity name
class WebhookRepository {
  findWebhookById(id: string) { ... }
  createWebhook(data: NewWebhook) { ... }
}
```

### Rule 2: Name what extra data a method returns

When a method joins related tables or returns more than the base columns, say so with `With...`.

```typescript
// Good - from EventTypeRepository
findManyByUserIdWithDetails(userId: number, { visibleOnly = false } = {}) { ... }

// Bad - the name hides that hosts and schedules are joined in
findManyByUserId(userId: number) { ... } // ...but returns hosts, schedule and links too
```

### Rule 3: Keep methods generic, not tied to one screen

Name a method after the data it returns, not the caller that uses it.

```typescript
// Good - reusable descriptions of the data
class BookingRepository {
  findByUid(uid: string) { ... }
  findSeries(recurringEventId: string) { ... }
  findLastBookedAt(eventTypeId: number, userIds: number[]) { ... }
}

// Bad - use-case names
class BookingRepository {
  findBookingsForBookingsPage(userId: number) { ... }
  findBookingsForRoundRobin(eventTypeId: number) { ... }
}
```

### Rule 4: No business logic in repositories

Repositories only read and write. Ownership checks, status rules, emails and events belong in the
Service.

```typescript
// Good - BookingActionsService decides; BookingRepository only reads
private async hostBooking(hostId: number, uid: string) {
  const found = await this.deps.bookingRepo.findByUid(uid);
  if (!found || found.userId !== hostId) throw new AppError("booking_not_found", 404);
  return found;
}

// Bad - the repository enforcing who may act
class BookingRepository {
  async findByUidForHost(uid: string, hostId: number) {
    const found = await this.findByUid(uid);
    if (found?.userId !== hostId) throw new AppError("booking_not_found", 404);
    return found;
  }
}
```

A repository method may encode a data-integrity guarantee the database must enforce in one
statement (`BookingRepository.insertIfSlotFree` uses `conditionalInsert` so two bookers can't take
the same slot). That is atomicity, not business policy: the service still decides when to call it.

### Summary

- Concise names: `findById`, not `findWebhookById`
- `With...` when a method returns related data: `findManyByUserIdWithDetails`
- Describe the data, not the caller
- No business rules in repositories

Reference: [Cal.diy Engineering Blog](https://cal.com/blog/engineering-in-2026-and-beyond)
