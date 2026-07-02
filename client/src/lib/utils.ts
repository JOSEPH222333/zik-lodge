import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Combines conditional classes and resolves conflicting Tailwind utilities.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currency values are displayed in Nigerian naira throughout the marketplace.
export function currency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(amount);
}

// Compact numbers keep dashboard metrics readable in small cards.
export function shortNumber(value: number) {
  return new Intl.NumberFormat("en-NG", { notation: "compact" }).format(value);
}
