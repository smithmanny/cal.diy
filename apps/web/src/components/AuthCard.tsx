import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="mb-6 font-heading text-3xl">Cal.diy</div>
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xs">
        <h1 className="font-heading text-xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground text-sm">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-4 text-muted-foreground text-sm">{footer}</div>}
    </main>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-destructive/8 px-3 py-2 text-destructive-foreground text-sm">
      {message}
    </p>
  );
}
