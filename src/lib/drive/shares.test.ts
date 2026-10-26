import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { FOLDER_MIME, type DriveFile } from "./client";
import { applyShares, makeFoldersPrivate, reconcileShares, type DriveOps } from "./shares";

const ROOT = "root";
const now = "2026-10-27T00:00:00Z";
const folder = (id: string, augmented = true): DriveFile => ({ id, name: id, mimeType: FOLDER_MIME, parents: [ROOT], createdTime: now, modifiedTime: now, augmented });
const file = (id: string, parent: string, augmented = false): DriveFile => ({ id, name: id, mimeType: "image/jpeg", parents: [parent], createdTime: now, modifiedTime: now, augmented });
const want = (file_id: string, folder_id: string | null = "F1", kind = "media") => ({ file_id, kind, folder_id });

type Row = { file_id: string; kind: string; shared: boolean; direct: boolean; last_error: string | null; updated_at: string };

/** Enough of the Supabase client for shares.ts. */
function fakeDb(desired: ReturnType<typeof want>[], rows: Partial<Row>[] = [], media: Record<string, string> = {}) {
  const table = new Map<string, Row>(rows.map((r) => [r.file_id!, { kind: "media", shared: true, direct: true, last_error: null, updated_at: new Date().toISOString(), ...r } as Row]));
  const ok = (data: unknown) => ({ data, error: null });
  return {
    table,
    rpc: async () => ok(desired),
    from: (name: string) => ({
      select: () => {
        if (name === "media") return { eq: (_c: string, id: string) => ({ maybeSingle: async () => ok(media[id] ? { wells: { drive_folder_id: media[id] } } : null) }) };
        return Promise.resolve(ok([...table.values()]));
      },
      upsert: async (r: Row) => { table.set(r.file_id, r); return ok(null); },
      delete: () => ({ eq: async (_c: string, id: string) => { table.delete(id); return ok(null); } }),
    }),
  };
}

/**
 * A model of Drive sharing: each item may have its own "anyone" link; a folder's link is
 * inherited by everything inside it. `stubborn` files ignore share() (to check we verify).
 */
function fakeDrive(own: string[] = [], stubborn: string[] = []): DriveOps & { own: Set<string>; log: string[] } {
  const ownSet = new Set(own); const log: string[] = [];
  return {
    own: ownSet, log,
    async share(id) { log.push(`share ${id}`); if (!stubborn.includes(id)) ownSet.add(id); },
    async directLink(id) { return ownSet.has(id); },
    async unshare(id) { log.push(`unshare ${id}`); ownSet.delete(id); },
  };
}

const run = (db: unknown, files: DriveFile[], ops: DriveOps, deadline?: number) =>
  // @ts-expect-error fake client
  reconcileShares(db, files, ROOT, ops, deadline);

describe("phase 1: sharing files on their own (every sync)", () => {
  it("shares each visible file, confirms Drive gave it its own link, and leaves folders alone", async () => {
    const db = fakeDb([want("a"), want("b")]);
    const drive = fakeDrive(["F1"]);
    const r = await run(db, [folder("F1"), file("a", "F1"), file("b", "F1")], drive);
    expect(r).toMatchObject({ shared: 2, verified: 2, wanted: 2, errors: [] });
    expect(drive.own.has("F1")).toBe(true);
    expect(db.table.get("a")).toMatchObject({ shared: true, direct: true });
  });

  it("doesn't trust a share Drive won't confirm: records it unconfirmed and retries next run", async () => {
    const db = fakeDb([want("a")]);
    const drive = fakeDrive([], ["a"]);
    const r = await run(db, [folder("F1"), file("a", "F1")], drive);
    expect(r.verified).toBe(0);
    expect(r.errors.join()).toMatch(/didn't confirm/);
    expect(db.table.get("a")).toMatchObject({ direct: false });
  });

  it("re-shares a file whose own link was removed outside WellWatch (Drive is the source of truth)", async () => {
    const db = fakeDb([want("a")], [{ file_id: "a" }]);
    const drive = fakeDrive([]);
    await run(db, [folder("F1"), file("a", "F1", false)], drive);
    expect(drive.own.has("a")).toBe(true);
  });

  it("removes the link from a hidden photo, even one shared by hand with no record", async () => {
    const db = fakeDb([]);
    const drive = fakeDrive(["h"]);
    const r = await run(db, [folder("F1"), file("h", "F1", true)], drive);
    expect(r.unshared).toBe(1);
    expect(drive.own.has("h")).toBe(false);
  });

  it("never touches well folders in phase 1", async () => {
    const db = fakeDb([]);
    const drive = fakeDrive(["F1"]);
    await run(db, [folder("F1", true)], drive);
    expect(drive.own.has("F1")).toBe(true);
  });

  it("tries a file outside the Wells drive at most once a day", async () => {
    const db = fakeDb([want("x", "F1", "report")], [{ file_id: "x", direct: false, last_error: "insufficient permissions", updated_at: new Date().toISOString() }]);
    const drive = fakeDrive([], ["x"]);
    await run(db, [folder("F1"), file("a", "F1")], drive);
    expect(drive.log).not.toContain("share x");
  });

  it("does the most urgent work first: files in folders that are already private", async () => {
    const db = fakeDb([want("old", "F1"), want("new", "F2")], [{ file_id: "F2", kind: "folder", shared: false, direct: false }]);
    const drive = fakeDrive();
    const r = await run(db, [folder("F1"), folder("F2", false), file("old", "F1"), file("new", "F2")], drive, Date.now() - 1);
    expect(r.more).toBe(true);
    expect(drive.log).toEqual([]);
    const r2 = await run(fakeDb([want("old", "F1"), want("new", "F2")], [{ file_id: "F2", kind: "folder", shared: false, direct: false }]), [folder("F1"), folder("F2", false), file("old", "F1"), file("new", "F2")], drive);
    expect(r2.shared).toBe(2);
    expect(drive.log[0]).toBe("share new");
  });

  it("takes the link off a private folder that someone shared again by hand, and says so", async () => {
    const db = fakeDb([], [{ file_id: "F1", kind: "folder", shared: false, direct: false }]);
    const drive = fakeDrive(["F1"]);
    const r = await run(db, [folder("F1", true)], drive);
    expect(drive.own.has("F1")).toBe(false);
    expect(r.errors.join()).toMatch(/shared by link again/);
  });
});

describe("phase 2: making folders private (admin button)", () => {
  // @ts-expect-error fake client
  const priv = (db: unknown, files: DriveFile[], ops: DriveOps) => makeFoldersPrivate(db, files, ROOT, ops);

  it("waits while any of a folder's visible files lacks its own link", async () => {
    const db = fakeDb([want("a"), want("b")]);
    const drive = fakeDrive(["F1", "a"]);
    const r = await priv(db, [folder("F1"), file("a", "F1"), file("b", "F1")], drive);
    expect(r.madePrivate).toEqual([]);
    expect(r.skipped.join()).toMatch(/1 file/);
    expect(drive.own.has("F1")).toBe(true);
  });

  it("makes a ready folder private, keeps its files viewable, and records it", async () => {
    const db = fakeDb([want("a")]);
    const drive = fakeDrive(["F1", "a"]);
    const r = await priv(db, [folder("F1"), file("a", "F1")], drive);
    expect(r.madePrivate).toEqual(["F1"]);
    expect(drive.own.has("F1")).toBe(false);
    expect(drive.own.has("a")).toBe(true);
    expect(db.table.get("F1")).toMatchObject({ kind: "folder", shared: false });
  });

  it("'Try one folder first' stops after one", async () => {
    const db = fakeDb([]);
    const drive = fakeDrive(["F1", "F2"]);
    // @ts-expect-error fake client
    const r = await makeFoldersPrivate(db, [folder("F1"), folder("F2")], ROOT, drive, undefined, 1);
    expect(r.madePrivate).toHaveLength(1);
    expect(drive.own.size).toBe(1);
  });

  it("finds files by where they really are, including subfolders", async () => {
    const db = fakeDb([want("deep", "WRONG")]);
    const drive = fakeDrive(["F1"]);
    const sub: DriveFile = { ...folder("S1"), parents: ["F1"] };
    const r = await priv(db, [folder("F1"), sub, file("deep", "S1")], drive);
    expect(r.madePrivate).toEqual([]);
    expect(r.skipped.join()).toMatch(/F1/);
  });
});

describe("hide/show straight away", () => {
  it("says honestly when a hidden photo is still reachable through its shared folder", async () => {
    const db = fakeDb([], [{ file_id: "h" }], { h: "F1" });
    const drive = fakeDrive(["h"]);
    // @ts-expect-error fake client
    const note = await applyShares(db, ["h"], drive);
    expect(drive.own.has("h")).toBe(false);
    expect(note).toMatch(/still shared by link/);
  });
  it("says nothing once the folder is private", async () => {
    const db = fakeDb([], [{ file_id: "h" }, { file_id: "F1", kind: "folder", shared: false, direct: false }], { h: "F1" });
    // @ts-expect-error fake client
    expect(await applyShares(db, ["h"], fakeDrive(["h"]))).toBeNull();
  });
});
