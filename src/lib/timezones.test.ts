import { describe, expect, it } from "vitest";
import { countryTimeZone, exifLocalToIso, tzOffsetMinutes } from "./timezones";

describe("timezones", () => {
  it("maps well countries to zones, unknown to UTC", () => {
    expect(countryTimeZone("MW")).toBe("Africa/Blantyre");
    expect(countryTimeZone("np")).toBe("Asia/Kathmandu");
    expect(countryTimeZone("XX")).toBe("UTC");
    expect(countryTimeZone(null)).toBe("UTC");
  });
  it("computes offsets", () => {
    const d = new Date("2025-07-06T12:00:00Z");
    expect(tzOffsetMinutes("Africa/Blantyre", d)).toBe(120);
    expect(tzOffsetMinutes("Asia/Kathmandu", d)).toBe(345);
    expect(tzOffsetMinutes("UTC", d)).toBe(0);
  });
  it("interprets EXIF wall-clock time in the well's zone", () => {
    expect(exifLocalToIso("2025:07:06 14:55:02", "Africa/Blantyre")).toBe("2025-07-06T12:55:02.000Z");
    expect(exifLocalToIso("2025:07:06 14:55:02", "Asia/Kolkata")).toBe("2025-07-06T09:25:02.000Z");
    expect(exifLocalToIso("2025:07:06 00:30:00", "Africa/Kampala")).toBe("2025-07-05T21:30:00.000Z");
    expect(exifLocalToIso("garbage", "UTC")).toBeUndefined();
    expect(exifLocalToIso(undefined, "UTC")).toBeUndefined();
  });
});
