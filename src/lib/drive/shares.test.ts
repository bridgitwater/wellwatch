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
 * A model of Drive sharing, matching what production showed: a file can't get a link of
 * its own while its folder shares the same link (share() is a silent no-op then).
 * `stubborn` files never take a link. `parents` maps file -> folder.
 */
function fakeDrive(own: string[] = [], stubborn: string[] = [], parents: Record<string, string> = {}): DriveOps & { own: Set<string>; log: string[] } {
  const ownSet = new Set(own); const log: string[] = [];
  return {
    own: ownSet, log,
    async share(id) {
      log.push(`share ${id}`);
      if (stubborn.includes(id)) return;
      if (parents[id] && ownSet.has(parents[id])) return; // inherited link already there: Drive adds nothing
      ownSet.add(id);
    },
    async directLink(id) { return ownSet.has(id); },
    async unshare(id) { log.push(`unshare ${id}`); ownSet.delete(id); },
  };
}

const run = (db: unknown, files: DriveFile[], ops: DriveOps, deadline?: number) =>
  // @ts-expect-error fake client
  reconcileShares(db, files, ROOT, ops, deadline);

const PRIVATE_F1 = { file_id: "F1", kind: "folder", shared: false, direct: false };

describe("every sync", () => {
  it("leaves files in folders that are still shared alone (the folder's link covers them)", async () => {
    const db = fakeDb([want("a")]);
    const drive = fakeDrive(["F1"], [], { a: "F1" });
    const r = await run(db, [folder("F1"), file("a", "F1")], drive);
    expect(drive.log).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it("gives new files in a private folder their own link, confirmed", async () => {
    const db = fakeDb([want("a")], [PRIVATE_F1]);
    const drive = fakeDrive([], [], { a: "F1" });
    const r = await run(db, [folder("F1", false), file("a", "F1")], drive);
    expect(r).toMatchObject({ shared: 1, verified: 1, errors: [] });
    expect(db.table.get("a")).toMatchObject({ shared: true, direct: true });
  });

  it("doesn't trust a share Drive won't confirm: records it unconfirmed and retries next run", async () => {
    const db = fakeDb([want("a")], [PRIVATE_F1]);
    const r = await run(db, [folder("F1", false), file("a", "F1")], fakeDrive([], ["a"]));
    expect(r.verified).toBe(0);
    expect(r.errors.join()).toMatch(/didn't confirm/);
  });

  it("re-shares a file whose own link was removed outside WellWatch (Drive is the source of truth)", async () => {
    const db = fakeDb([want("a")], [PRIVATE_F1, { file_id: "a" }]);
    const drive = fakeDrive([]);
    await run(db, [folder("F1", false), file("a", "F1", false)], drive);
    expect(drive.own.has("a")).toBe(true);
  });

  it("removes the link from a hidden photo, even one shared by hand with no record", async () => {
    const db = fakeDb([]);
    const drive = fakeDrive(["h"]);
    const r = await run(db, [folder("F1"), file("h", "F1", true)], drive);
    expect(r.unshared).toBe(1);
    expect(drive.own.has("h")).toBe(false);
  });

  it("never makes well folders private on its own", async () => {
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

  it("takes the link off a private folder that someone shared again by hand, and says so", async () => {
    const db = fakeDb([], [PRIVATE_F1]);
    const drive = fakeDrive(["F1"]);
    const r = await run(db, [folder("F1", true)], drive);
    expect(drive.own.has("F1")).toBe(false);
    expect(r.errors.join()).toMatch(/shared by link again/);
  });
});

describe("making folders private (admin button)", () => {
  // @ts-expect-error fake client
  const priv = (db: unknown, files: DriveFile[], ops: DriveOps, max?: number) => makeFoldersPrivate(db, files, ROOT, ops, undefined, max, 0);

  it("removes the folder's link, then gives each visible file its own, confirmed, and records it", async () => {
    const db = fakeDb([want("a"), want("b")]);
    const drive = fakeDrive(["F1"], [], { a: "F1", b: "F1" });
    const r = await priv(db, [folder("F1"), file("a", "F1"), file("b", "F1")], drive);
    expect(r).toMatchObject({ madePrivate: ["F1"], errors: [] });
    expect(drive.log[0]).toBe("unshare F1");
    expect([...drive.own].sort()).toEqual(["a", "b"]);
    expect(db.table.get("F1")).toMatchObject({ kind: "folder", shared: false });
    expect(db.table.get("a")).toMatchObject({ direct: true });
  });

  it("puts the folder's link back if any file can't get its own (nothing breaks for funders)", async () => {
    const db = fakeDb([want("a"), want("b")]);
    const drive = fakeDrive(["F1"], ["b"], { a: "F1", b: "F1" });
    const r = await priv(db, [folder("F1"), file("a", "F1"), file("b", "F1")], drive);
    expect(r.madePrivate).toEqual([]);
    expect(drive.own.has("F1")).toBe(true);
    expect(r.errors.join()).toMatch(/folder's link was put back/);
    expect(db.table.get("F1")).toBeUndefined();
  });

  it("retries a file once when Drive is slow to drop the folder's link", async () => {
    const db = fakeDb([want("a")]);
    let tries = 0;
    const drive = fakeDrive(["F1"], [], { a: "F1" });
    const slow: DriveOps = { ...drive, async share(id) { if (id === "a" && ++tries === 1) return; await drive.share(id); } };
    const r = await priv(db, [folder("F1"), file("a", "F1")], slow);
    expect(r.madePrivate).toEqual(["F1"]);
    expect(r.errors).toEqual([]);
    expect(tries).toBe(2);
  });

  it("'Try one folder first' stops after one", async () => {
    const db = fakeDb([]);
    const drive = fakeDrive(["F1", "F2"]);
    const r = await priv(db, [folder("F1"), folder("F2")], drive, 1);
    expect(r.madePrivate).toHaveLength(1);
    expect(drive.own.size).toBe(1);
  });

  it("finds files by where they really are, including subfolders", async () => {
    const db = fakeDb([want("deep", "WRONG")]);
    const drive = fakeDrive(["F1"], [], { deep: "S1" });
    const sub: DriveFile = { ...folder("S1"), parents: ["F1"] };
    const r = await priv(db, [folder("F1"), sub, file("deep", "S1")], drive);
    expect(r.madePrivate).toEqual(["F1"]);
    expect(drive.own.has("deep")).toBe(true);
  });

  it("skips folders already private", async () => {
    const db = fakeDb([], [PRIVATE_F1]);
    const drive = fakeDrive([]);
    const r = await priv(db, [folder("F1", false)], drive);
    expect(r.madePrivate).toEqual([]);
    expect(drive.log).toEqual([]);
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
    const db = fakeDb([], [{ file_id: "h" }, PRIVATE_F1], { h: "F1" });
    // @ts-expect-error fake client
    expect(await applyShares(db, ["h"], fakeDrive(["h"]))).toBeNull();
  });
  it("showing a photo in a still-shared folder needs no Drive change", async () => {
    const db = fakeDb([want("a")]);
    const drive = fakeDrive(["F1"], [], { a: "F1" });
    // @ts-expect-error fake client
    expect(await applyShares(db, ["a"], drive)).toBeNull();
    expect(drive.log).toEqual([]);
  });
  it("showing a photo in a private folder gives it its own link", async () => {
    const db = fakeDb([want("a")], [PRIVATE_F1]);
    const drive = fakeDrive([], [], { a: "F1" });
    // @ts-expect-error fake client
    expect(await applyShares(db, ["a"], drive)).toBeNull();
    expect(drive.own.has("a")).toBe(true);
  });
});
