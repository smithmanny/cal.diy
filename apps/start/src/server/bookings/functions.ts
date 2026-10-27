import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { isEmailEnabled } from "../emails/container";
import { authMiddleware, optionalUserId } from "../middleware";
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

export const resolvePrivateLink = createServerFn({ method: "GET" })
  .validator(z.object({ link: z.string().min(1).max(64), slug: z.string().min(1).max(200) }))
  .handler(async ({ data }) => (await getBookingService()).resolvePrivateLink(data.link, data.slug));

export const getAvailableSlots = createServerFn({ method: "GET" })
  .validator(slotsQuerySchema)
  .handler(async ({ data }) => (await getBookingService()).getAvailableSlots(data));

export const createBooking = createServerFn({ method: "POST" })
  .validator(createBookingSchema)
  .handler(async ({ data }) => (await getBookingService()).create(data, await optionalUserId()));

export const sendBookerVerificationCode = createServerFn({ method: "POST" })
  .validator(
    usernameSchema.extend({
      slug: z.string().min(1).max(200),
      email: z.string().trim().email().max(320),
      locale: z.string().max(20).default("en"),
    })
  )
  .handler(async ({ data }) =>
    (await getBookingService()).sendVerificationCode(data.username, data.slug, data.email, data.locale)
  );

// The uid is an unguessable token handed to the attendee and host, as in Cal.

export const getBookingByUid = createServerFn({ method: "GET" })
  .validator(uidSchema.extend({ seatReferenceUid: z.string().max(100).optional() }))
  .handler(async ({ data }) => ({
    ...(await (await getBookingService()).getBooking(data.uid, data.seatReferenceUid)),
    // The confirmation page only promises an email when one is actually sent.
    emailsEnabled: isEmailEnabled(),
  }));

export const cancelBookingByUid = createServerFn({ method: "POST" })
  .validator(
    uidSchema.extend({
      reason: z.string().max(1000).optional(),
      cancelledBy: z.string().email().optional(),
      seatReferenceUid: z.string().max(100).optional(),
    })
  )
  .handler(async ({ data }) => {
    const service = await getBookingService();
    // On a seated booking a booker cancels only their own seat.
    if (data.seatReferenceUid) return service.cancelSeat(data.seatReferenceUid, data.reason ?? null);
    return service.cancel(data.uid, data.reason ?? null, data.cancelledBy ?? null);
  });

// Host endpoints.

export const listHostBookings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      filter: z.enum(["upcoming", "recurring", "past", "cancelled", "unconfirmed"]),
      limit: z.number().int().min(1).max(500),
    })
  )
  .handler(async ({ context, data }) => {
    const bookings = await (await getBookingService()).listForHost(context.userId, data.filter, data.limit);
    return bookings.map((booking) => ({
      ...booking,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
    }));
  });

export const cancelBookingAsHost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    uidSchema.extend({ reason: z.string().max(1000).optional(), allRemaining: z.boolean().default(false) })
  )
  .handler(async ({ context, data }) =>
    (await getBookingService()).cancelAsHost(context.userId, data.uid, data.reason ?? null, data.allRemaining)
  );

export const decideBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(uidSchema.extend({ accept: z.boolean(), reason: z.string().max(1000).optional() }))
  .handler(async ({ context, data }) =>
    (await getBookingService()).decide(context.userId, data.uid, data.accept, data.reason ?? null)
  );
