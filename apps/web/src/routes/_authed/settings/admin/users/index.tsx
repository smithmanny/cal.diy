import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { requireAdmin } from "~/lib/admin-guard";
import { authClient } from "~/lib/auth-client";
import { authErrorKey } from "~/lib/auth-errors";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import {
  deleteAdminUser,
  listAdminUsers,
  sendAdminPasswordReset,
  setAdminUserLocked,
} from "~/server/admin/functions";

const PAGE_SIZE = 25;

const MESSAGE_KEYS = [
  "users",
  "users_description",
  "search",
  "name_or_email",
  "edit",
  "lock_user",
  "unlock_user",
  "user_locked",
  "user_unlocked",
  "locked",
  "admin",
  "impersonate",
  "reset_password",
  "password_reset_email_sent",
  "delete_user",
  "confirm_delete_user",
  "user_deleted",
  "previous",
  "next",
  "no_results",
  "cannot_lock_yourself",
  "cannot_delete_yourself",
  "admin_needs_two_factor",
  "something_went_wrong",
  "unauthorized",
];

type AdminUser = Awaited<ReturnType<typeof listAdminUsers>>["users"][number];

function useAdminAction() {
  const router = useRouter();
  const [message, setMessage] = useState<{ key: string; error: boolean } | null>(null);
  async function run(action: () => Promise<unknown>, successKey: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ key: successKey, error: false });
      await router.invalidate();
    } catch (error) {
      setMessage({ key: errorMessageKey(error), error: true });
    }
  }
  return { run, message, setMessage };
}

function UserActions({
  user,
  run,
  onError,
}: {
  user: AdminUser;
  run: (action: () => Promise<unknown>, successKey: string) => Promise<void>;
  onError: (key: string) => void;
}) {
  const t = useT();
  async function impersonate() {
    const { error } = await authClient.admin.impersonateUser({ userId: String(user.id) });
    if (error) onError(authErrorKey(error));
    else window.location.assign("/event-types");
  }
  return (
    <div className="flex flex-wrap gap-1">
      <Button
        size="xs"
        variant="outline"
        render={<Link to="/settings/admin/users/$userId" params={{ userId: user.id }} />}>
        {t("edit")}
      </Button>
      <Button
        size="xs"
        variant="outline"
        onClick={() =>
          run(
            () => setAdminUserLocked({ data: { id: user.id, locked: !user.locked } }),
            user.locked ? "user_unlocked" : "user_locked"
          )
        }>
        {t(user.locked ? "unlock_user" : "lock_user")}
      </Button>
      <Button size="xs" variant="outline" onClick={impersonate}>
        {t("impersonate")}
      </Button>
      <Button
        size="xs"
        variant="outline"
        onClick={() =>
          run(() => sendAdminPasswordReset({ data: { id: user.id } }), "password_reset_email_sent")
        }>
        {t("reset_password")}
      </Button>
      <Button
        size="xs"
        variant="destructive-outline"
        onClick={() => {
          if (window.confirm(t("confirm_delete_user")))
            run(() => deleteAdminUser({ data: { id: user.id } }), "user_deleted");
        }}>
        {t("delete_user")}
      </Button>
    </div>
  );
}

function SearchForm({ search }: { search: string }) {
  const t = useT();
  const navigate = useNavigate({ from: Route.fullPath });
  const [value, setValue] = useState(search);
  function submit(event: FormEvent) {
    event.preventDefault();
    navigate({ search: { q: value.trim() || undefined, page: undefined } });
  }
  return (
    <form onSubmit={submit} role="search" className="mb-4 flex gap-2">
      <Input
        type="search"
        aria-label={t("name_or_email")}
        placeholder={t("name_or_email")}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button type="submit" variant="outline">
        {t("search")}
      </Button>
    </form>
  );
}

function UserRow({ user, children }: { user: AdminUser; children: ReactNode }) {
  const t = useT();
  return (
    <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 text-sm">
        <div className="flex items-center gap-2 font-medium">
          {user.name || user.username}
          {user.role === "ADMIN" && <Badge variant="info">{t("admin")}</Badge>}
          {user.locked && <Badge variant="error">{t("locked")}</Badge>}
        </div>
        <div className="truncate text-muted-foreground">
          {user.email}
          {user.username && ` · ${user.username}`}
        </div>
      </div>
      {children}
    </li>
  );
}

function AdminUsersPage() {
  const { users, total } = Route.useLoaderData();
  const { q = "", page = 0 } = Route.useSearch();
  const t = useT();
  const { run, message, setMessage } = useAdminAction();
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  return (
    <HydratedFieldset>
      <p className="mb-4 text-muted-foreground text-sm">{t("users_description")}</p>
      <SearchForm search={q} />
      {message?.error ? (
        <FormError message={t(message.key)} />
      ) : (
        message && (
          <p role="status" className="mb-4 text-sm">
            {t(message.key)}
          </p>
        )
      )}
      {users.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          {t("no_results")}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {users.map((user) => (
            <UserRow key={user.id} user={user}>
              <UserActions user={user} run={run} onError={(key) => setMessage({ key, error: true })} />
            </UserRow>
          ))}
        </ul>
      )}
      <nav className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {users.length ? `${page * PAGE_SIZE + 1}-${page * PAGE_SIZE + users.length} / ${total}` : ""}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            render={<Link to="." search={{ q: q || undefined, page: page - 1 || undefined }} />}>
            {t("previous")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= lastPage}
            render={<Link to="." search={{ q: q || undefined, page: page + 1 }} />}>
            {t("next")}
          </Button>
        </div>
      </nav>
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/admin/users/")({
  validateSearch: (search: Record<string, unknown>): { q?: string; page?: number } => {
    const page = Number(search.page);
    const q = search.q === undefined || search.q === null ? "" : String(search.q).slice(0, 200);
    return { q: q || undefined, page: Number.isInteger(page) && page > 0 ? page : undefined };
  },
  beforeLoad: ({ context }) => requireAdmin(context),
  loaderDeps: ({ search }) => ({ q: search.q, page: search.page ?? 0 }),
  loader: async ({ context, deps }) => {
    const [messages, result] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      listAdminUsers({ data: { search: deps.q, page: deps.page, pageSize: PAGE_SIZE } }),
    ]);
    return { messages, ...result };
  },
  component: AdminUsersPage,
});
