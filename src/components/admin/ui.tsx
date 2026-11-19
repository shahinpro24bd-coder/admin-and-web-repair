import type { ReactNode } from "react";

export const btnOutline =
  "inline-flex items-center justify-center gap-2 border border-foreground bg-card px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-admin-accent-soft disabled:opacity-50";
export const btnAccent =
  "inline-flex items-center justify-center gap-2 border border-admin-accent bg-admin-accent px-3 py-1.5 text-sm text-admin-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
export const btnDanger =
  "inline-flex items-center justify-center gap-1 border border-destructive px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10";
export const btnSmall =
  "inline-flex items-center justify-center gap-1 border border-border bg-card px-2 py-1 text-xs text-foreground transition-colors hover:bg-admin-accent-soft";
export const input = "mt-1 w-full border border-input bg-background px-3 py-2 text-sm text-foreground";
export const heading = "font-['Teko','Oswald',sans-serif] tracking-wide";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-card p-5 shadow-sm ${className}`}>{children}</div>;
}

const tones: Record<string, string> = {
  green: "bg-admin-ok/15 text-admin-ok",
  red: "bg-destructive/15 text-destructive",
  amber: "bg-admin-warn/20 text-admin-warn",
  blue: "bg-admin-accent/20 text-foreground",
  gray: "bg-muted text-muted-foreground",
};
export function Pill({ children, tone = "gray" }: { children: ReactNode; tone?: string | undefined }) {
  return (
    <span className={`inline-block whitespace-nowrap px-2 py-0.5 text-xs font-medium capitalize ${tones[tone] ?? tones["gray"]}`}>
      {children}
    </span>
  );
}
