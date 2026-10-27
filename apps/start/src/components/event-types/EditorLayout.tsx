import { Switch } from "@coss/ui/components/switch";
import type { ReactNode } from "react";
import type { EventTypeInput } from "~/server/event-types/types";

export type SetField = <K extends keyof EventTypeInput>(key: K, value: EventTypeInput[K]) => void;

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border p-4">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 font-medium text-sm">
      {label}
      {children}
    </label>
  );
}

export function ToggleBlock({
  title,
  description,
  checked,
  onCheckedChange,
  children,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-sm">
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
        <span className="flex flex-col">
          <span className="font-medium">{title}</span>
          {description && <span className="text-muted-foreground">{description}</span>}
        </span>
      </label>
      {checked && children && <div className="ps-10">{children}</div>}
    </div>
  );
}

/** Cal descriptions link out with Trans markup (<0>Learn more</0>); this app shows the text only. */
export function withoutLinks(text: string): string {
  return text.replace(/\s*<(\d+)>.*?<\/\1>/g, "").trim();
}

/** Splits a Trans message around its <0></0> slot, where Cal puts an input. */
export function aroundSlot(text: string): [string, string] {
  const [before, after = ""] = text.split(/<0>.*?<\/0>/);
  return [before.trim(), after.trim()];
}
