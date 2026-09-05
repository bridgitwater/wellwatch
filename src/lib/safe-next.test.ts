import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps ordinary paths", () => {
    expect(safeNext("/wells")).toBe("/wells");
    expect(safeNext("/wells/MW-2025-019?tab=updates#photos")).toBe("/wells/MW-2025-019?tab=updates#photos");
    expect(safeNext("/admin/wells/new")).toBe("/admin/wells/new");
  });
  it("rejects protocol-relative and absolute targets", () => {
    expect(safeNext("//evil.example")).toBe("/wells");
    expect(safeNext("//evil.example/wells")).toBe("/wells");
    expect(safeNext("/\\evil.example")).toBe("/wells");
    expect(safeNext("https://evil.example")).toBe("/wells");
    expect(safeNext("javascript:alert(1)")).toBe("/wells");
    expect(safeNext(" //evil.example")).toBe("/wells");
    expect(safeNext("/wells\r\nSet-Cookie: x")).toBe("/wells");
    expect(safeNext("/javascript:alert(1)")).toBe("/wells");
  });
  it("falls back on non-strings", () => {
    expect(safeNext(undefined)).toBe("/wells");
    expect(safeNext(["/a", "/b"])).toBe("/wells");
    expect(safeNext(null, "/login")).toBe("/login");
  });
});
