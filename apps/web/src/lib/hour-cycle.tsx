import { createContext, type ReactNode, useContext } from "react";

// undefined follows the locale's convention.
const HourCycleContext = createContext<boolean | undefined>(undefined);

export function HourCycleProvider({
  hour12,
  children,
}: {
  hour12: boolean | undefined;
  children: ReactNode;
}) {
  return <HourCycleContext.Provider value={hour12}>{children}</HourCycleContext.Provider>;
}

/** Whether times render 12-hour (true), 24-hour (false), or as the locale prefers (undefined). */
export function useHour12(): boolean | undefined {
  return useContext(HourCycleContext);
}
