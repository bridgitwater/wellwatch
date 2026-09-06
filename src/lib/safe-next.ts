/**
 * Only allow same-origin, path-only redirect targets. Rejects protocol-relative
 * URLs ("//evil.com", "/\evil.com"), absolute URLs, and anything with control
 * characters or whitespace. Anything else falls back to /wells.
 */
export function safeNext(raw: unknown, fallback = "/wells"): string {
  if (typeof raw !== "string") return fallback;
  const s = raw.trim();
  if (!s.startsWith("/")) return fallback;
  if (s.startsWith("//") || s.startsWith("/\\")) return fallback;
  if (/[\x00-\x1f\x7f\s]/.test(s)) return fallback;
  if (/^\/[^/?#]*:/.test(s)) return fallback; // "/javascript:..." style oddities
  if (s.length > 2000) return fallback;
  return s;
}
