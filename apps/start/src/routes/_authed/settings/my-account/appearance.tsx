import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import { Switch } from "@coss/ui/components/switch";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { FormError } from "~/components/AuthCard";
import { HydratedFieldset } from "~/components/HydratedFieldset";
import { isHexColor, passesContrast } from "~/lib/brand-color";
import { errorMessageKey } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { loadMessages } from "~/lib/messages";
import type { ThemePreference } from "~/lib/theme";
import { getAppearance, updateAppearance } from "~/server/settings/functions";

const MESSAGE_KEYS = [
  "app_theme",
  "app_theme_applies_note",
  "theme",
  "theme_applies_note",
  "theme_system",
  "light",
  "dark",
  "custom_brand_colors",
  "customize_your_brand_colors",
  "light_brand_color",
  "dark_brand_color",
  "light_theme_contrast_error",
  "dark_theme_contrast_error",
  "disable_cal_branding",
  "removes_cal_branding",
  "update",
  "settings_updated_successfully",
  "something_went_wrong",
];

const THEME_OPTIONS: { value: ThemePreference; labelKey: string }[] = [
  { value: null, labelKey: "theme_system" },
  { value: "light", labelKey: "light" },
  { value: "dark", labelKey: "dark" },
];

function ThemePicker({
  name,
  legend,
  note,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  note: string;
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}) {
  const t = useT();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-medium text-sm">{legend}</legend>
      <p className="text-muted-foreground text-xs">{note}</p>
      <div className="flex flex-wrap gap-2">
        {THEME_OPTIONS.map((option) => (
          <label
            key={option.labelKey}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm has-checked:border-foreground">
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {t(option.labelKey)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ColorField({
  label,
  value,
  onChange,
  warning,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  warning: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={isHexColor(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="size-9 cursor-pointer rounded-md border bg-transparent p-0.5"
        />
        <Input
          aria-label={`${label} (hex)`}
          value={value}
          maxLength={7}
          pattern="#[0-9a-fA-F]{6}"
          onChange={(event) => onChange(event.target.value)}
          className="w-32 font-mono"
        />
      </div>
      {warning && <p className="text-warning-foreground text-xs">{warning}</p>}
    </div>
  );
}

function AppearancePage() {
  const { appearance } = Route.useLoaderData();
  const t = useT();
  const router = useRouter();
  const [values, setValues] = useState(appearance);
  const [status, setStatus] = useState<{ kind: "error" | "saved"; key: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    try {
      await updateAppearance({ data: values });
      // The dashboard theme comes from the session.
      await router.invalidate();
      setStatus({ kind: "saved", key: "settings_updated_successfully" });
    } catch (error) {
      setStatus({ kind: "error", key: errorMessageKey(error) });
    }
  }

  const lightWarning =
    isHexColor(values.brandColor) && !passesContrast(values.brandColor, "light")
      ? t("light_theme_contrast_error")
      : null;
  const darkWarning =
    isHexColor(values.darkBrandColor) && !passesContrast(values.darkBrandColor, "dark")
      ? t("dark_theme_contrast_error")
      : null;

  return (
    <HydratedFieldset>
      <form method="post" onSubmit={onSubmit} className="flex max-w-lg flex-col gap-6">
        <ThemePicker
          name="appTheme"
          legend={t("app_theme")}
          note={t("app_theme_applies_note")}
          value={values.appTheme}
          onChange={(appTheme) => setValues({ ...values, appTheme })}
        />
        <ThemePicker
          name="theme"
          legend={t("theme")}
          note={t("theme_applies_note")}
          value={values.theme}
          onChange={(theme) => setValues({ ...values, theme })}
        />
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium text-sm">{t("custom_brand_colors")}</h2>
            <p className="text-muted-foreground text-xs">{t("customize_your_brand_colors")}</p>
          </div>
          <div className="flex flex-wrap gap-6">
            <ColorField
              label={t("light_brand_color")}
              value={values.brandColor}
              onChange={(brandColor) => setValues({ ...values, brandColor })}
              warning={lightWarning}
            />
            <ColorField
              label={t("dark_brand_color")}
              value={values.darkBrandColor}
              onChange={(darkBrandColor) => setValues({ ...values, darkBrandColor })}
              warning={darkWarning}
            />
          </div>
        </section>
        <label className="flex items-start justify-between gap-4 text-sm">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{t("disable_cal_branding", { appName: "Cal.diy" })}</span>
            <span className="text-muted-foreground">{t("removes_cal_branding", { appName: "Cal.diy" })}</span>
          </span>
          <Switch
            checked={values.hideBranding}
            onCheckedChange={(hideBranding) => setValues({ ...values, hideBranding })}
          />
        </label>
        {status?.kind === "error" && <FormError message={t(status.key)} />}
        {status?.kind === "saved" && (
          <p role="status" className="text-sm text-success-foreground">
            {t(status.key)}
          </p>
        )}
        <Button type="submit" className="self-start">
          {t("update")}
        </Button>
      </form>
    </HydratedFieldset>
  );
}

export const Route = createFileRoute("/_authed/settings/my-account/appearance")({
  loader: async ({ context }) => {
    const [messages, appearance] = await Promise.all([loadMessages(context, MESSAGE_KEYS), getAppearance()]);
    return { messages, appearance };
  },
  component: AppearancePage,
});
