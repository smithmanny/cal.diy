import { createFileRoute } from "@tanstack/react-router";
import { getOnboardingRepository } from "~/server/onboarding/container";
import { decodeAvatar } from "~/server/onboarding/OnboardingService";

/** Cal's avatar URLs, /api/avatar/<objectKey>.png; each upload gets a new key, so they cache forever. */
export const Route = createFileRoute("/api/avatar/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const objectKey = params.file.replace(/\.png$/, "");
        const stored = await (await getOnboardingRepository()).findAvatar(objectKey);
        const image = stored ? decodeAvatar(stored) : null;
        if (!image) return new Response("Not found", { status: 404 });
        return new Response(image.body, {
          headers: {
            "content-type": image.contentType,
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
