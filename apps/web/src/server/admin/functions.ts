import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getAdminService } from "./container";
import { adminMiddleware } from "./middleware";

const idSchema = z.object({ id: z.number().int().positive() });

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      search: z.string().trim().max(200).optional(),
      page: z.number().int().min(0).default(0),
      pageSize: z.number().int().min(1).max(100).default(25),
    })
  )
  .handler(async ({ data }) => (await getAdminService()).list(data.search, data.page, data.pageSize));

export const getAdminUser = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(idSchema)
  .handler(async ({ data }) => (await getAdminService()).get(data.id));

export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(
    idSchema.extend({
      name: z.string().trim().max(200),
      email: z.string().trim().email().max(320),
      username: z.string().trim().min(1).max(100),
      role: z.enum(["USER", "ADMIN"]),
      timeZone: z.string().min(1).max(100),
      locale: z.string().min(2).max(20),
    })
  )
  .handler(async ({ context, data }) => {
    const { id, ...input } = data;
    await (await getAdminService()).update(context.adminId, id, input);
  });

export const setAdminUserLocked = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(idSchema.extend({ locked: z.boolean() }))
  .handler(async ({ context, data }) =>
    (await getAdminService()).setLocked(context.adminId, data.id, data.locked)
  );

export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(idSchema)
  .handler(async ({ context, data }) => (await getAdminService()).remove(context.adminId, data.id));

export const sendAdminPasswordReset = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(idSchema)
  .handler(async ({ data }) => (await getAdminService()).sendPasswordReset(data.id));
