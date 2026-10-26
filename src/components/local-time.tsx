"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * A timestamp in the viewer's own time zone. The server renders in UTC, so
 * server-formatted times read 12 hours out in Fiji; this formats in the browser.
 */
export function LocalTime({ iso, withDate = true }: { iso: string; withDate?: boolean }) {
  // Before hydration (and on the server) there is no viewer time zone: render nothing time-specific.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return <time dateTime={iso}>…</time>;
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = withDate
    ? { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }
    : { hour: "numeric", minute: "2-digit" };
  return <time dateTime={iso} title={d.toString()}>{d.toLocaleString(undefined, opts)}</time>;
}
