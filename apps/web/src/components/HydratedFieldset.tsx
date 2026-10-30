import { useHydrated } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Disables every control inside until React has hydrated. Before that, edits would be reverted
 * and clicks would hit no handler, which on slow devices (a Pi, an old phone) looks like a broken page.
 */
export function HydratedFieldset({ children, className }: { children: ReactNode; className?: string }) {
  const hydrated = useHydrated();
  return (
    <fieldset disabled={!hydrated} className={className ?? "contents"}>
      {children}
    </fieldset>
  );
}
