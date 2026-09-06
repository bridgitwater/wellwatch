"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

/** A village-level pin. Coordinates are the well's approximate (jittered) location. */
export function WellMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !ref.current) return;
      const m = new maplibregl.Map({
        container: ref.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [lng, lat],
        zoom: 3, // continent view: shows which part of the world the well is in; visitors can zoom in
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      map = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      const el = document.createElement("div");
      el.className = "h-4 w-4 rounded-full bg-[#17607d] ring-4 ring-[#17607d]/25 border-2 border-white";
      el.setAttribute("aria-label", label);
      new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(m);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, label]);

  return <div ref={ref} className="h-64 w-full rounded-lg overflow-hidden bg-aquifer" role="region" aria-label={`Map showing ${label}`} />;
}
