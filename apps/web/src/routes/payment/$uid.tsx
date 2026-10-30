import { Button } from "@coss/ui/components/button";
import { createFileRoute, notFound, redirect, useRouter } from "@tanstack/react-router";
import { CreditCardIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { ThemeScope } from "~/components/ThemeScope";
import { formatLongDate, formatTime } from "~/lib/date-utils";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import { formatMoney } from "~/lib/money";
import { getPaymentPage, startCheckout } from "~/server/payments/functions";

const MESSAGE_KEYS = [
  "complete_your_booking",
  "payment",
  "what",
  "when",
  "price",
  "pay_now",
  "payment_processing",
  "booking_with_payment_cancelled",
  "booking_with_payment_cancelled_refunded",
  "something_went_wrong",
  "not_found",
];

/** Back from Checkout before Stripe's webhook: check again for a while, then leave it to the webhook. */
function useWaitForPayment(waiting: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!waiting) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (attempts > 30) clearInterval(timer);
      else router.invalidate();
    }, 2000);
    return () => clearInterval(timer);
  }, [waiting, router]);
}

function PaymentPage() {
  const { payment } = Route.useLoaderData();
  const { checkout } = Route.useSearch();
  const { locale } = Route.useRouteContext();
  const t = useT();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const timeZone = payment.hostTimeZone ?? "UTC";
  const closed = payment.cancelled || payment.refunded;
  useWaitForPayment(checkout === "success" && !closed);

  async function pay() {
    setErrorKey(null);
    try {
      const { url } = await startCheckout({ data: { uid: payment.uid } });
      window.location.href = url;
    } catch (error) {
      setErrorKey(errorMessageKey(error));
    }
  }

  return (
    <ThemeScope theme={null}>
      <main className="flex min-h-screen flex-col items-center bg-muted/40 px-4 py-12">
        <HydratedFieldset className="flex w-full max-w-xl flex-col gap-6 rounded-xl border bg-background p-6">
          <header className="flex flex-col items-center gap-2 text-center">
            <CreditCardIcon className="size-10 text-muted-foreground" />
            <h1 className="font-heading text-xl">{t("complete_your_booking")}</h1>
          </header>
          <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 border-t pt-6 text-sm">
            <dt className="font-medium">{t("what")}</dt>
            <dd>{payment.eventTitle ?? payment.title}</dd>
            <dt className="font-medium">{t("when")}</dt>
            <dd>
              {formatLongDate(payment.startTime, timeZone, locale)}{" "}
              {formatTime(payment.startTime, timeZone, locale)} –{" "}
              {formatTime(payment.endTime, timeZone, locale)} ({timeZone})
            </dd>
            <dt className="font-medium">{t("price")}</dt>
            <dd>{formatMoney(payment.amount, payment.currency, locale)}</dd>
          </dl>
          <FormError message={errorKey && t(errorKey)} />
          <PaymentAction payment={payment} checkout={checkout} onPay={pay} />
        </HydratedFieldset>
      </main>
    </ThemeScope>
  );
}

function PaymentAction({
  payment,
  checkout,
  onPay,
}: {
  payment: Awaited<ReturnType<typeof getPaymentPage>>;
  checkout: string | undefined;
  onPay: () => void;
}) {
  const t = useT();
  if (payment.refunded) return <p role="status">{t("booking_with_payment_cancelled_refunded")}</p>;
  if (payment.cancelled) return <p role="status">{t("booking_with_payment_cancelled")}</p>;
  if (checkout === "success") return <p role="status">{t("payment_processing")}</p>;
  return (
    <Button onClick={onPay} className="self-end">
      {t("pay_now")}
    </Button>
  );
}

export const Route = createFileRoute("/payment/$uid")({
  validateSearch: (search: Record<string, unknown>): { checkout?: string } => ({
    checkout: search.checkout === "success" ? "success" : undefined,
  }),
  loaderDeps: ({ search }) => ({ checkout: search.checkout }),
  loader: async ({ context, params, deps }) => {
    const [messages, payment] = await Promise.all([
      loadMessages(context, MESSAGE_KEYS),
      getPaymentPage({ data: { uid: params.uid, returnedFromCheckout: deps.checkout === "success" } }).catch(
        () => {
          throw notFound();
        }
      ),
    ]);
    // Paid: the booking's own page takes over, as after any booking.
    if (payment.paid && !payment.refunded)
      throw redirect({ to: "/booking/$uid", params: { uid: payment.bookingUid } });
    return { messages, payment };
  },
  component: PaymentPage,
});
