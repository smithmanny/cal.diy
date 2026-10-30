import { useMemo } from "react";
import { selectClass } from "./availability/TimeSelect";

function supportedTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

export function TimeZoneSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const zones = useMemo(() => {
    const all = supportedTimeZones();
    return all.includes(value) ? all : [value, ...all];
  }, [value]);
  return (
    <select
      id={id}
      className={`${selectClass} w-full`}
      value={value}
      onChange={(event) => onChange(event.target.value)}>
      {zones.map((zone) => (
        <option key={zone} value={zone}>
          {zone.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
