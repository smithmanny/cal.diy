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
