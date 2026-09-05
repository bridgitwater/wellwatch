import { describe, expect, it } from "vitest";
import { errorMessage, selectAll, withRetry } from "./admin";

/** Fake PostgREST builder backed by an in-memory array. */
function fakeTable(rows: { id: number }[], failFirst = 0) {
  let calls = 0;
  return () => ({
    order: () => ({
      range: async (from: number, to: number) => {
        calls++;
        if (calls <= failFirst) return { data: null, error: { message: "JWT expired", code: "PGRST301" } };
        return { data: rows.slice(from, to + 1), error: null };
      },
    }),
    calls: () => calls,
  });
}

describe("selectAll", () => {
  it("pages past the 1,000-row cap and returns every row", async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => ({ id: i }));
    const out = await selectAll<{ id: number }>("t", fakeTable(rows));
    expect(out).toHaveLength(2345);
    expect(out[2344].id).toBe(2344);
  });
  it("stops after one page when the table is small, and handles empty tables", async () => {
    expect(await selectAll<{ id: number }>("t", fakeTable([{ id: 1 }]))).toHaveLength(1);
    expect(await selectAll<{ id: number }>("t", fakeTable([]))).toHaveLength(0);
  });
  it("retries a transient PostgREST error", async () => {
    const t = fakeTable([{ id: 1 }], 1);
    expect(await selectAll<{ id: number }>("t", t, "id", 1000)).toHaveLength(1);
  });
});

describe("withRetry / errorMessage", () => {
  it("gives up with a readable message, not [object Object]", async () => {
    const err = { message: "permission denied for table wells", code: "42501" };
    await expect(withRetry("read", async () => ({ data: null, error: err }), 2, 1)).rejects.toThrow(
      /read failed after 2 attempts: permission denied for table wells — code=42501/,
    );
    expect(errorMessage(err)).toBe("permission denied for table wells — code=42501");
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("plain")).toBe("plain");
  });
});
