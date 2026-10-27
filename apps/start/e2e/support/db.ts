import process from "node:process";
import { createLibsqlDatabase } from "@calcom/db/drivers/libsql";
import { booking } from "@calcom/db/schema";
import { eq } from "drizzle-orm";

/**
 * Direct access to the dev server's database, for states the UI can't reach (a booking in the
 * past). Only for the default dev-server run; specs using it skip against E2E_BASE_URL.
 */
export async function moveBookingToPast(uid: string, hoursAgo = 2): Promise<void> {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL is only set when the suite starts its own dev server");
  const db = await createLibsqlDatabase({ url });
  const startTime = new Date(Date.now() - hoursAgo * 3_600_000);
  const [found] = await db
    .select({ startTime: booking.startTime, endTime: booking.endTime })
    .from(booking)
    .where(eq(booking.uid, uid));
  if (!found) throw new Error(`No booking ${uid}`);
  const endTime = new Date(startTime.getTime() + (found.endTime.getTime() - found.startTime.getTime()));
  await db.update(booking).set({ startTime, endTime }).where(eq(booking.uid, uid));
}
