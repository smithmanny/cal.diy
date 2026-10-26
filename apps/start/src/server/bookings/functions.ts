import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getBookingService } from "./container";
import { createBookingSchema, slotsQuerySchema } from "./types";

const usernameSchema = z.object({ username: z.string().min(1).max(100) });
const uidSchema = z.object({ uid: z.string().min(1).max(100) });

// Public endpoints: anyone may view a profile, see slots and book.

export const getPublicProfile = createServerFn({ method: "GET" })
  .validator(usernameSchema)
  .handler(async ({ data }) => (await getBookingService()).getProfile(data.username));

export const getPublicEvent = createServerFn({ method: "GET" })
  .validator(usernameSchema.extend({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data }) => (await getBookingService()).getPublicEvent(data.username, data.slug));

export const getAvailableSlots = createServerFn({ method: "GET" })
  .validator(slotsQuerySchema)
  .handler(async ({ data }) => (await getBookingService()).getAvailableSlots(data));

export const createBooking = createServerFn({ method: "POST" })
  .validator(createBookingSchema)
  .handler(async ({ data }) => (await getBookingService()).create(data));

// The uid is an unguessable token handed to the attendee and host, as in Cal.

export const getBookingByUid = createServerFn({ method: "GET" })
  .validator(uidSchema)
  .handler(async ({ data }) => (await getBookingService()).getBooking(data.uid));

export const cancelBookingByUid = createServerFn({ method: "POST" })
  .validator(
    uidSchema.extend({ reason: z.string().max(1000).optional(), cancelledBy: z.string().email().optional() })
  )
  .handler(async ({ data }) =>
    (await getBookingService()).cancel(data.uid, data.reason ?? null, data.cancelledBy ?? null)
  );
