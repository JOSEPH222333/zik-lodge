import { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "../lib/utils";

// Shared button keeps interaction styling consistent across pages and dashboards.
export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground shadow-soft hover:translate-y-[-1px]",
        variant === "secondary" && "border border-border bg-card text-foreground hover:bg-secondary",
        variant === "ghost" && "text-foreground hover:bg-secondary",
        variant === "danger" && "bg-destructive text-destructive-foreground hover:brightness-95",
        className
      )}
      {...props}
    />
  );
}

// Card accepts a div or form wrapper so layout styling can be reused for form panels.
export function Card({ as: Component = "div", className, ...props }: { as?: "div" | "form"; className?: string; [key: string]: unknown }) {
  return <Component className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}

// Badge is used for small labels, section eyebrows, and status chips.
export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground", className)} {...props} />;
}

// Form controls centralize Tailwind classes so future validation styling is easy to add.
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring", className)} {...props} />;
}
