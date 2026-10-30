---
title: Test the Code You Add or Change
impact: HIGH
impactDescription: Untested code is where regressions hide
tags: testing, coverage, quality, vitest
---

## Test the Code You Add or Change

**Impact: HIGH**

Every PR should come with tests for the code it introduces or modifies, aiming at 80%+ coverage
of that code. If you add 50 lines of logic, those lines should be exercised by a test; if you change
a function's behavior, a test should show the new behavior.

CI doesn't enforce a coverage threshold, so check it yourself when it matters:

```bash
yarn workspace @calcom/web vitest run --coverage src/server/webhooks
```

**Where tests go:**
- Unit tests next to the code: `apps/web/src/server/<domain>/<Name>.test.ts`, `apps/web/src/lib/*.test.ts`, `packages/scheduling/src/*.test.ts`, `packages/db/src/*.test.ts`
- Browser tests for user-visible flows: `apps/web/e2e/*.spec.ts` (see `testing-playwright`)

**Incorrect (untested service method):**

```typescript
// WebhookService.ts - new rule with no test
async create(userId: number, input: WebhookInput) {
  if (await this.repo.findByUserIdAndUrl(userId, input.subscriberUrl))
    throw new AppError("webhook_subscriber_url_reserved", 409);
  ...
}
```

**Correct (tested against a real database, from `WebhookService.test.ts`):**

```typescript
beforeEach(async () => {
  db = await createTestDb();
  repo = new WebhookRepository(db);
  service = new WebhookService(repo);
  [{ id: ownerId }, { id: otherId }] = await db
    .insert(user)
    .values([{ email: "owner@example.com" }, { email: "other@example.com" }])
    .returning({ id: user.id });
});

it("rejects a duplicate URL for the same user and hides other users' webhooks", async () => {
  const { id } = await service.create(ownerId, input);
  await expect(service.create(ownerId, input)).rejects.toMatchObject({
    code: "webhook_subscriber_url_reserved",
  });
  await expect(service.get(otherId, id)).rejects.toMatchObject({ code: "not_found" });
});
```

**What to cover:**
- The happy path and each `AppError` a method can throw
- Permission checks: another user's or another team's data is refused
- Time zones and DST for anything date-related (tests run with `TZ=UTC`)
- D1 limits for bulk writes (enough rows to cross `chunkRowsForInsert`'s chunk size)

**On "coverage isn't the full story":**
Coverage doesn't prove tests are good, and tests can hit every line while checking nothing. But a
high number is still far better than not knowing where you are.

Reference: [Cal.diy Engineering Blog](https://cal.com/blog/engineering-in-2026-and-beyond)
