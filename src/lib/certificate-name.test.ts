import { describe, expect, it } from "vitest";
import { certificateName } from "./certificate";

describe("certificateName", () => {
  it("prefers the admin's sponsor line", () => {
    expect(certificateName("margaret.chen", "margaret.chen@example.com", "The Chen Family")).toBe("The Chen Family");
  });
  it("never prints an email local part", () => {
    expect(certificateName("margaret.chen", "margaret.chen@example.com", null)).toBe("A generous supporter");
    expect(certificateName(null, "margaret.chen@example.com", null)).toBe("A generous supporter");
    expect(certificateName("  ", "x@example.com", null)).toBe("A generous supporter");
  });
  it("uses a real display name", () => {
    expect(certificateName("Margaret Chen", "margaret.chen@example.com", null)).toBe("Margaret Chen");
  });
});
