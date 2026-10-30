import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { getAuth } from "../auth/auth";
import { authMiddleware } from "../middleware";
// Only referenced inside handlers, so these server-only modules stay out of the client bundle.
import { getTeamService } from "./container";
import { withTeamErrors } from "./errors";

const teamId = z.number().int().positive();
const role = z.enum(["MEMBER", "ADMIN", "OWNER"]);
/** Cal's team slugs: lowercase letters, digits and dashes. */
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

async function api() {
  return { auth: await getAuth(), headers: getRequestHeaders() };
}

export const listTeams = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await getTeamService()).list(context.userId, context.userEmail));

export const getTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ teamId }))
  .handler(async ({ context, data }) => (await getTeamService()).get(context.userId, data.teamId));

export const createTeam = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(1).max(100),
      slug,
      isOrganization: z.boolean().default(false),
      parentId: teamId.optional(),
    })
  )
  .handler(async ({ context, data }) => {
    if (data.parentId) await (await getTeamService()).assertCanCreateIn(context.userId, data.parentId);
    const { auth, headers } = await api();
    const created = await withTeamErrors(() =>
      auth.api.createOrganization({
        headers,
        body: {
          name: data.name,
          slug: data.slug,
          isOrganization: data.isOrganization && !data.parentId,
          parentId: data.parentId,
          // Creating a team shouldn't switch the creator's session to it.
          keepCurrentActiveOrganization: true,
        },
      })
    );
    return { id: Number(created?.id) };
  });

export const updateTeam = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      teamId,
      name: z.string().trim().min(1).max(100),
      slug,
      bio: z.string().max(1000).nullable(),
    })
  )
  .handler(async ({ data }) => {
    const { auth, headers } = await api();
    await withTeamErrors(() =>
      auth.api.updateOrganization({
        headers,
        body: {
          organizationId: String(data.teamId),
          data: { name: data.name, slug: data.slug, bio: data.bio ?? undefined },
        },
      })
    );
  });

export const deleteTeam = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ teamId }))
  .handler(async ({ data }) => {
    const { auth, headers } = await api();
    await withTeamErrors(() =>
      auth.api.deleteOrganization({ headers, body: { organizationId: String(data.teamId) } })
    );
  });

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ teamId, email: z.string().trim().toLowerCase().email().max(320), role }))
  .handler(async ({ data }) => {
    const { auth, headers } = await api();
    await withTeamErrors(() =>
      auth.api.createInvitation({
        headers,
        body: { organizationId: String(data.teamId), email: data.email, role: data.role },
      })
    );
  });

export const cancelTeamInvitation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ invitationId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const { auth, headers } = await api();
    await withTeamErrors(() =>
      auth.api.cancelInvitation({ headers, body: { invitationId: String(data.invitationId) } })
    );
  });

export const updateTeamMemberRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ teamId, memberId: z.number().int().positive(), role }))
  .handler(async ({ data }) => {
    const { auth, headers } = await api();
    await withTeamErrors(() =>
      auth.api.updateMemberRole({
        headers,
        body: { organizationId: String(data.teamId), memberId: String(data.memberId), role: data.role },
      })
    );
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ teamId, memberId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const { auth, headers } = await api();
    await withTeamErrors(() =>
      auth.api.removeMember({
        headers,
        body: { organizationId: String(data.teamId), memberIdOrEmail: String(data.memberId) },
      })
    );
  });

export const leaveTeam = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ teamId }))
  .handler(async ({ data }) => {
    const { auth, headers } = await api();
    await withTeamErrors(() =>
      auth.api.leaveOrganization({ headers, body: { organizationId: String(data.teamId) } })
    );
  });

export const getTeamInvitation = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ invitationId: z.number().int().positive() }))
  .handler(async ({ context, data }) =>
    (await getTeamService()).invitationFor(context.userEmail, data.invitationId)
  );

export const respondToTeamInvitation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ invitationId: z.number().int().positive(), accept: z.boolean() }))
  .handler(async ({ data }) => {
    const { auth, headers } = await api();
    const body = { invitationId: String(data.invitationId) };
    if (data.accept) await withTeamErrors(() => auth.api.acceptInvitation({ headers, body }));
    else await withTeamErrors(() => auth.api.rejectInvitation({ headers, body }));
  });
