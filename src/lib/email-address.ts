import { z } from "zod";

/** The one way WellWatch reads an email address: trimmed, lower-case, and valid. */
export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
