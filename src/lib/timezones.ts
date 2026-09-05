/**
 * Well countries → IANA time zones. Photos are taken where the well is, so EXIF
 * capture times (which carry no zone) are interpreted in the well's local zone,
 * and update dates are shown in that zone too — a photo taken on 6 July in
 * Malawi is "6 Jul" for a funder in Fiji or Perth alike.
 */
export const COUNTRY_TZ: Record<string, string> = {
  UG: "Africa/Kampala",
  MW: "Africa/Blantyre",
  TZ: "Africa/Dar_es_Salaam",
  KE: "Africa/Nairobi",
  RW: "Africa/Kigali",
  ZM: "Africa/Lusaka",
  ZW: "Africa/Harare",
  MZ: "Africa/Maputo",
  ET: "Africa/Addis_Ababa",
  SS: "Africa/Juba",
  IN: "Asia/Kolkata",
  NP: "Asia/Kathmandu",
  BD: "Asia/Dhaka",
  KH: "Asia/Phnom_Penh",
  PH: "Asia/Manila",
  PG: "Pacific/Port_Moresby",
  FJ: "Pacific/Fiji",
  AU: "Australia/Sydney",
};

export function countryTimeZone(country: string | null | undefined): string {
  return (country && COUNTRY_TZ[country.toUpperCase()]) || "UTC";
}

/** Offset of `zone` from UTC, in minutes, at the given instant (handles DST). */
export function tzOffsetMinutes(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * Drive reports EXIF time as "2026:07:06 14:55:02" — local wall-clock time, no
 * zone. Interpret it in `zone` and return an ISO instant.
 */
export function exifLocalToIso(exif: string | null | undefined, zone: string): string | undefined {
  if (!exif) return undefined;
  const m = exif.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  // Offset at (approximately) that instant; a second pass corrects DST-edge cases.
  let offset = tzOffsetMinutes(zone, new Date(wall));
  offset = tzOffsetMinutes(zone, new Date(wall - offset * 60000));
  return new Date(wall - offset * 60000).toISOString();
}
