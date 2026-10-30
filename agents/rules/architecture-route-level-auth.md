---
paths:
  - "apps/web/src/routes/**"
  - "apps/web/src/server/**/functions.ts"
title: Authorize in beforeLoad and on the Server, Never in a Layout Component
impact: CRITICAL
impactDescription: Prevents unauthorized access to sensitive data
tags: security, authorization, tanstack-router, server-functions, architecture
---

## Authorize in beforeLoad and on the Server, Never in a Layout Component

**Impact: CRITICAL (Prevents unauthorized access to sensitive data)**

There are two places for permission checks, and they do different jobs:

1. **The server function or API route** is the real check. Server functions are plain HTTP
   endpoints that anyone can call without loading the page, so every one that touches private
   data runs `authMiddleware` (or `adminMiddleware`) and the Service checks ownership or role.
2. **The route's `beforeLoad`** keeps people from seeing pages they can't use: it redirects to
   login or throws `notFound()`. It runs on the server and on client navigation, before the
   loader.

Never put a permission check in a component's render (such as a layout component like
`AppShell`): by then the loader has already fetched the data, and the check can be skipped.

**Incorrect (check in a component, no server check):**

```tsx
function AdminUsersPage() {
  const { user } = Route.useRouteContext();
  if (!user?.isAdmin) return <NotFound />; // The loader already ran listAdminUsers
  return <UsersTable />;
}

export const listAdminUsers = createServerFn({ method: "GET" }) // No middleware: anyone can call it
  .handler(async () => (await getAdminService()).list());
```

**Correct (guard in beforeLoad, check again on the server):**

```tsx
// apps/web/src/routes/_authed/settings/admin/users/index.tsx
export const Route = createFileRoute("/_authed/settings/admin/users/")({
  beforeLoad: ({ context }) => requireAdmin(context), // ~/lib/admin-guard: throws notFound()
  // loader calls listAdminUsers
});
```

```typescript
// apps/web/src/server/admin/functions.ts
export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([adminMiddleware]) // Role and (in production) 2FA checked on every call
  .validator(z.object({ search: z.string().trim().max(200).optional(), page: z.number(), pageSize: z.number() }))
  .handler(async ({ data }) => (await getAdminService()).list(data.search, data.page, data.pageSize));
```

The `_authed` pathless route (`apps/web/src/routes/_authed.tsx`) does its sign-in redirect in
`beforeLoad`, which TanStack Router runs for every child route; its component only renders the
shell. That redirect is a convenience, not a security boundary: the child's server functions
still need `authMiddleware`.

**Key rules:**
- Every server function that reads or changes private data has `authMiddleware` or `adminMiddleware`
- Services check ownership (`findOwned`) or team role (`canManage`) before returning or changing data
- Answer "not yours" with a 404 (`AppError("not_found", 404)`) so ids can't be probed
- Use `beforeLoad` for redirects and `notFound()`, not component code

See `PERMISSIONS.md` for the roles and where each check lives.
