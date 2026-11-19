import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes safely using clsx and tailwind-merge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date string in Asia/Dhaka timezone for Bangladesh job deadlines.
 */
export function formatDhakaDate(isoDate: string | Date): string {
  const date = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  return new Intl.DateTimeFormat("en-BD", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

/**
 * Computes remaining days until a job application deadline.
 */
export function getRemainingDeadlineDays(deadlineIso: string): number {
  const deadlineMs = new Date(deadlineIso).getTime();
  const nowMs = Date.now();
  return Math.ceil((deadlineMs - nowMs) / (1000 * 60 * 60 * 24));
}

/**
 * Generates a URL-safe slug from an English title.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
