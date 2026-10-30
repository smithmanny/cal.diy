import type { TFunction } from "~/lib/i18n";

/** Hosts can turn this off with "Disable Cal.diy branding" in Appearance settings. */
export function PoweredBy({ hidden, t }: { hidden: boolean; t: TFunction }) {
  if (hidden) return null;
  return (
    <p className="py-4 text-center text-muted-foreground text-xs">
      {t("powered_by")} <span className="font-heading">Cal.diy</span>
    </p>
  );
}
