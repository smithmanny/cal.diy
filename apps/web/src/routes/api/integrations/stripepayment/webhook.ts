import { createFileRoute } from "@tanstack/react-router";
import { AppError } from "~/server/errors";
import { getPaymentService } from "~/server/payments/container";

/** Stripe's Connect webhook (Cal's path): confirms paid bookings when checkout completes. */
export const Route = createFileRoute("/api/integrations/stripepayment/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const service = await getPaymentService();
        if (!service) return new Response("Stripe is not configured", { status: 404 });
        // The signature covers the exact bytes, so the body is read as text, never re-serialized.
        const payload = await request.text();
        try {
          await service.handleWebhook(payload, request.headers.get("stripe-signature"));
        } catch (error) {
          if (error instanceof AppError && error.status === 400)
            return Response.json({ error: error.code }, { status: 400 });
          // Stripe retries on 5xx, which is what a passing failure (say, the database) wants.
          console.error("Handling a Stripe webhook failed", error);
          return Response.json({ error: "something_went_wrong" }, { status: 500 });
        }
        return Response.json({ received: true });
      },
    },
  },
});
