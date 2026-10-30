import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../middleware";
// Only referenced inside handlers, so this server-only module stays out of the client bundle.
import { getOnboardingService } from "./container";

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => (await getOnboardingService()).state(context.userId));

export const saveOnboardingUserSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(1).max(200),
      username: z.string().trim().min(1).max(100),
      timeZone: z.string().min(1).max(100),
    })
  )
  .handler(async ({ context, data }) =>
    (await getOnboardingService()).saveUserSettings(context.userId, data)
  );

export const finishOnboarding = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ bio: z.string().max(1000), avatar: z.string().max(600_000).nullable() }))
  .handler(async ({ context, data }) => (await getOnboardingService()).finish(context.userId, data));
