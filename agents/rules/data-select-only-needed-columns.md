---
title: Select Only the Columns You Need in Drizzle Queries
impact: HIGH
impactDescription: Reduces data transfer and prevents accidental exposure of secrets
tags: drizzle, database, performance, security
---

## Select Only the Columns You Need in Drizzle Queries

**Impact: HIGH (Reduces data transfer and prevents accidental exposure of secrets)**

Pass an explicit column map to `db.select({ ... })`. A bare `db.select()` returns every column,
including secrets (`credential.key`, `credential.encryptedKey`, `webhook.secret`, password hashes in
`Account.password`), and couples callers to the whole table.

**Incorrect (whole rows):**

```typescript
const [found] = await this.db.select().from(credential).where(eq(credential.userId, userId));
// found.key and found.encryptedKey now travel wherever `found` goes
```

```typescript
// Joins without a column map return every column of every joined table
const rows = await this.db.select().from(membership).innerJoin(user, eq(user.id, membership.userId));
```

**Correct (explicit columns, from `teams/TeamRepository.ts`):**

```typescript
const teamColumns = {
  id: team.id,
  name: team.name,
  slug: team.slug,
  bio: team.bio,
  logoUrl: team.logoUrl,
  isOrganization: team.isOrganization,
  parentId: team.parentId,
  timeZone: team.timeZone,
};

async findById(teamId: number) {
  const [found] = await this.db.select(teamColumns).from(team).where(eq(team.id, teamId)).limit(1);
  return found ?? null;
}

findMembers(teamId: number) {
  return this.db
    .select({ id: membership.id, userId: user.id, name: user.name, email: user.email, role: membership.role })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(and(eq(membership.teamId, teamId), eq(membership.accepted, true)));
}
```

**Benefits:**
- **Performance**: smaller rows from D1/SQLite, smaller payloads
- **Security**: secrets are only read by the code that needs them
- **Clarity**: the query states what the caller uses

**Secrets:**
- Credential keys are read only by `apps/web/src/server/apps/CredentialRepository.ts` and opened by `CredentialVault`; they never leave the server
- Services turn rows into DTOs before returning them, so a secret can't ride along (`WebhookService` returns `hasSecret`, never `secret`)
- An existence check selects only the id: `.select({ id: webhook.id })`

Reference: [Cal.diy Engineering Standards](https://cal.com/blog/engineering-in-2026-and-beyond)
