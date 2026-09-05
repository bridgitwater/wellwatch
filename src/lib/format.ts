export function fmtMoney(amount: number | string | null | undefined, currency = "AUD") {
  if (amount == null) return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  }).format(new Date(d));
}

export function fmtInt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU").format(n);
}

export const COUNTRY_NAME: Record<string, string> = {
  UG: "Uganda",
  ET: "Ethiopia",
  MW: "Malawi",
  IN: "India",
  NP: "Nepal",
  MM: "Myanmar",
  TZ: "Tanzania",
  AU: "Australia",
};

export function countryName(code: string) {
  return COUNTRY_NAME[code] ?? code;
}

/** "3 hours ago", "yesterday", "12 Jul" — for update timestamps. */
export function fmtRelative(d: string | Date) {
  const then = new Date(d).getTime();
  const diff = Date.now() - then;
  const h = Math.round(diff / 3.6e6);
  if (h < 1) return "just now";
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const days = Math.round(h / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return fmtDate(d);
}
