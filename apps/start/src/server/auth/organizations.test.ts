import type { Database } from "@calcom/db/database";
import { membership, team, teamInvitation, user } from "@calcom/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../test/testDb";
import { type AuthEmailSender, createAuth } from "./createAuth";

let db: Database;
let auth: ReturnType<typeof createAuth>;
let sent: Parameters<AuthEmailSender>[];

beforeEach(async () => {
  db = await createTestDb();
  sent = [];
  auth = createAuth({
    db,
    baseURL: "http://localhost:3000",
    secret: "test-secret-that-is-long-enough-123",
    clientIpHeaders: ["x-cal-client-ip"],
    rateLimit: false,
    sendAuthEmail: vi.fn(async (...args: Parameters<AuthEmailSender>) => void sent.push(args)),
  });
});

/** Invitees must have verified their email: invitation ids are serial, so guessable. */
async function signIn(email: string) {
  await auth.api.signUpEmail({ body: { name: email.split("@")[0], email, password: "Secret123" } });
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));
  const response = await auth.api.signInEmail({
    body: { email, password: "Secret123" },
    asResponse: true,
  });
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

describe("teams through Better Auth's organization plugin", () => {
  it("creates a Cal team with its owner, invites by email, and adds the invitee as a member", async () => {
    const owner = await signIn("owner@example.com");
    const created = await auth.api.createOrganization({
      headers: owner,
      body: { name: "Sales", slug: "sales", bio: "We sell", metadata: { color: "red" } },
    });

    const [row] = await db
      .select({ id: team.id, name: team.name, slug: team.slug, bio: team.bio, metadata: team.metadata })
      .from(team);
    expect(row).toEqual({
      id: Number(created?.id),
      name: "Sales",
      slug: "sales",
      bio: "We sell",
      metadata: { color: "red" },
    });
    expect(
      await db.select({ role: membership.role, accepted: membership.accepted }).from(membership)
    ).toEqual([{ role: "OWNER", accepted: true }]);

    const invitation = await auth.api.createInvitation({
      headers: owner,
      body: { organizationId: String(row.id), email: "member@example.com", role: "MEMBER" },
    });
    expect(sent.at(-1)?.slice(0, 4)).toEqual([
      "team_invite",
      { email: "member@example.com", name: null, locale: null },
      `http://localhost:3000/teams/invitations/${invitation.id}`,
      { inviter: "owner", team: "Sales" },
    ]);

    const member = await signIn("member@example.com");
    await auth.api.acceptInvitation({ headers: member, body: { invitationId: String(invitation.id) } });
    const roles = await db
      .select({ role: membership.role, accepted: membership.accepted })
      .from(membership)
      .where(eq(membership.teamId, row.id));
    expect(roles.map((entry) => entry.role).sort()).toEqual(["MEMBER", "OWNER"]);
    const [stored] = await db.select({ status: teamInvitation.status }).from(teamInvitation);
    expect(stored.status).toBe("accepted");
  });

  it("only lets owners and admins invite", async () => {
    const owner = await signIn("owner@example.com");
    const created = await auth.api.createOrganization({ headers: owner, body: { name: "Ops", slug: "ops" } });
    const invitation = await auth.api.createInvitation({
      headers: owner,
      body: { organizationId: String(created?.id), email: "member@example.com", role: "MEMBER" },
    });
    const member = await signIn("member@example.com");
    await auth.api.acceptInvitation({ headers: member, body: { invitationId: String(invitation.id) } });
    await expect(
      auth.api.createInvitation({
        headers: member,
        body: { organizationId: String(created?.id), email: "x@example.com", role: "MEMBER" },
      })
    ).rejects.toThrow();
  });
});
