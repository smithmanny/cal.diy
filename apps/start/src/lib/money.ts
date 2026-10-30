/** How many decimals a currency's smallest unit has (2 for USD, 0 for JPY), as Stripe counts them. */
function minorUnitDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ??
      2
    );
  } catch {
    return 2;
  }
}

/** Formats an amount in the currency's smallest unit (Stripe's and Cal's `price`), e.g. 1500 usd → $15.00. */
export function formatMoney(amount: number, currency: string, locale: string): string {
  const value = amount / 10 ** minorUnitDigits(currency);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() }).format(
      value
    );
  } catch {
    return `${value} ${currency.toUpperCase()}`;
  }
}

/** A price typed in major units ("15.5") as the smallest unit (1550), or null if it isn't one. */
export function parseMoney(input: string, currency: string): number | null {
  const value = Number(input.trim().replace(",", "."));
  if (!input.trim() || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 10 ** minorUnitDigits(currency));
}

/** Currencies Stripe accepts in Cal's currency picker, most used first. */
export const CURRENCIES = [
  "usd",
  "eur",
  "gbp",
  "cad",
  "aud",
  "chf",
  "jpy",
  "inr",
  "sek",
  "nok",
  "dkk",
  "nzd",
  "brl",
  "mxn",
  "sgd",
  "pln",
];
