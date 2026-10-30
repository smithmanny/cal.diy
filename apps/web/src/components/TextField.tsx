import { Input, type InputProps } from "@coss/ui/components/input";
import { Label } from "@coss/ui/components/label";
import { useId } from "react";

type TextFieldProps = Omit<InputProps, "id"> & { label: string; hint?: string };

export function TextField({ label, hint, ...inputProps }: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-describedby={hintId} {...inputProps} />
      {hint && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}
