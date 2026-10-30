import { Input } from "@coss/ui/components/input";
import { useState } from "react";
import { selectClass } from "~/components/availability/TimeSelect";
import type { TFunction } from "~/lib/i18n";
import { CURRENCIES, parseMoney } from "~/lib/money";
import type { EventTypeInput } from "~/server/event-types/types";
import { type SetField, ToggleBlock } from "./EditorLayout";

type Payment = NonNullable<EventTypeInput["payment"]>;

// Cal's starting point for a newly paid event.
const DEFAULT_PAYMENT: Payment = {
  price: 1000,
  currency: "usd",
  refundPolicy: "never",
  refundDaysCount: null,
  refundCountCalendarDays: true,
};

function majorUnits(payment: Payment): string {
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency: payment.currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  return String(payment.price / 10 ** digits);
}

function RefundPolicy({
  payment,
  update,
  t,
}: {
  payment: Payment;
  update: (patch: Partial<Payment>) => void;
  t: TFunction;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {t("refund_policy")}
      <select
        className={selectClass}
        aria-label={t("refund_policy")}
        value={payment.refundPolicy}
        onChange={(event) => {
          const refundPolicy = event.target.value as Payment["refundPolicy"];
          update({
            refundPolicy,
            refundDaysCount: refundPolicy === "days" ? (payment.refundDaysCount ?? 1) : null,
          });
        }}>
        <option value="never">{t("never")}</option>
        <option value="always">{t("always")}</option>
        <option value="days">{t("if_cancelled")}</option>
      </select>
      {payment.refundPolicy === "days" && (
        <>
          <Input
            type="number"
            min={1}
            max={365}
            className="w-16"
            aria-label={t("day_timeUnit")}
            value={payment.refundDaysCount ?? 1}
            onChange={(event) =>
              update({
                refundDaysCount: Math.min(365, Math.max(1, Math.floor(Number(event.target.value) || 1))),
              })
            }
          />
          <select
            className={selectClass}
            aria-label={t("calendar_days")}
            value={payment.refundCountCalendarDays ? "calendar" : "business"}
            onChange={(event) => update({ refundCountCalendarDays: event.target.value === "calendar" })}>
            <option value="calendar">{t("calendar_days")}</option>
            <option value="business">{t("business_days")}</option>
          </select>
          {t("before")}
        </>
      )}
    </div>
  );
}

/** Cal's Stripe app card: the event's price, its currency and when cancellations are refunded. */
export function PaymentEditor({ form, set, t }: { form: EventTypeInput; set: SetField; t: TFunction }) {
  const payment = form.payment ?? null;
  const [priceText, setPriceText] = useState(payment ? majorUnits(payment) : "");
  const update = (patch: Partial<Payment>) => set("payment", { ...(payment ?? DEFAULT_PAYMENT), ...patch });
  return (
    <ToggleBlock
      title={t("require_payment")}
      description={t("paid_event_description")}
      checked={payment !== null}
      onCheckedChange={(checked) => {
        set("payment", checked ? DEFAULT_PAYMENT : null);
        setPriceText(checked ? majorUnits(DEFAULT_PAYMENT) : "");
      }}>
      {payment && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Input
              inputMode="decimal"
              className="w-28"
              aria-label={t("price")}
              value={priceText}
              onChange={(event) => {
                setPriceText(event.target.value);
                const price = parseMoney(event.target.value, payment.currency);
                if (price) update({ price });
              }}
            />
            <select
              className={selectClass}
              aria-label={t("currency")}
              value={payment.currency}
              onChange={(event) => {
                const currency = event.target.value;
                update({ currency, price: parseMoney(priceText, currency) ?? payment.price });
              }}>
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <RefundPolicy payment={payment} update={update} t={t} />
        </div>
      )}
    </ToggleBlock>
  );
}

export const PAYMENT_EDITOR_MESSAGE_KEYS = [
  "payments",
  "require_payment",
  "paid_event_description",
  "price",
  "currency",
  "refund_policy",
  "never",
  "always",
  "if_cancelled",
  "day_timeUnit",
  "calendar_days",
  "business_days",
  "before",
  "paid_events_dont_support_seats_or_recurring",
];
