import { describe, expect, it } from "vitest";
import { FOLDER_MIME, parseExifTime, type DriveFile } from "./client";
import { parseWellCode, planSync, type DbMedia, type DbUpdate, type DbWell } from "./plan";

const ROOT = "root";

function folder(id: string, name: string, parent = ROOT): DriveFile {
  return { id, name, mimeType: FOLDER_MIME, parents: [parent], createdTime: "2026-01-01T00:00:00Z", modifiedTime: "2026-01-01T00:00:00Z" };
}
function photo(id: string, parent: string, takenAt: string, name = `${id}.jpg`): DriveFile {
  return {
    id, name, mimeType: "image/jpeg", parents: [parent],
    createdTime: takenAt, modifiedTime: takenAt, takenAt, width: 1600, height: 1200,
  };
}

const kyabirwa: DbWell = {
  id: "w1", code: "UG-2026-014", drive_folder_id: null,
  stages: [
    { stage: "funded", reached_at: "2026-06-15" },
    { stage: "survey", reached_at: "2026-06-24" },
    { stage: "drilling", reached_at: "2026-07-06" },
    { stage: "handover", reached_at: null },
  ],
};

describe("parseWellCode", () => {
  it("reads the code off the front of a folder name", () => {
    expect(parseWellCode("UG-2026-014 · Kyabirwa")).toBe("UG-2026-014");
    expect(parseWellCode("mw-2026-31 Chipoka")).toBe("MW-2026-031");
    expect(parseWellCode("  UG-2026-014")).toBe("UG-2026-014");
  });
  it("rejects folders without a code", () => {
    expect(parseWellCode("Photos from Grace")).toBeNull();
    expect(parseWellCode("Kyabirwa UG-2026-014")).toBeNull();
  });
});

describe("parseExifTime", () => {
  it("parses Drive's EXIF format", () => {
    expect(parseExifTime("2026:07:06 14:55:02")).toBe("2026-07-06T14:55:02.000Z");
    expect(parseExifTime(undefined)).toBeUndefined();
    expect(parseExifTime("garbage")).toBeUndefined();
  });
});

describe("planSync", () => {
  it("links a folder to its well by code and groups photos into hourly updates", () => {
    const files = [
      folder("f1", "UG-2026-014 · Kyabirwa"),
      photo("p1", "f1", "2026-07-06T08:10:00Z"),
      photo("p2", "f1", "2026-07-06T08:40:00Z"),
      photo("p3", "f1", "2026-07-06T14:55:00Z"),
      photo("p4", "f1", "2026-06-24T09:40:00Z"),
    ];
    const plan = planSync(ROOT, files, [kyabirwa], [], []);

    expect(plan.linkFolders).toEqual([{ well_id: "w1", drive_folder_id: "f1" }]);
    expect(plan.newUpdates).toHaveLength(3);
    const byTime = [...plan.newUpdates].sort((a, b) => a.happened_at.localeCompare(b.happened_at));
    expect(byTime[0].stage).toBe("survey");   // 24 June
    expect(byTime[1].media.map((m) => m.drive_file_id)).toEqual(["p1", "p2"]);
    expect(byTime[1].stage).toBe("drilling"); // 6 July morning
    expect(byTime[2].media.map((m) => m.drive_file_id)).toEqual(["p3"]);
    expect(plan.deleteMediaIds).toEqual([]);
  });

  it("follows files in subfolders up to the well folder", () => {
    const files = [
      folder("f1", "UG-2026-014 · Kyabirwa"),
      folder("sub", "Drilling day", "f1"),
      photo("p1", "sub", "2026-07-06T08:10:00Z"),
    ];
    const plan = planSync(ROOT, files, [{ ...kyabirwa, drive_folder_id: "f1" }], [], []);
    expect(plan.newUpdates).toHaveLength(1);
    expect(plan.newUpdates[0].media[0].well_id).toBe("w1");
  });

  it("attaches to an existing Drive update within the window, ignores admin updates", () => {
    const files = [folder("f1", "UG-2026-014 · Kyabirwa"), photo("p9", "f1", "2026-07-06T08:50:00Z")];
    const updates: DbUpdate[] = [
      { id: "u-admin", well_id: "w1", source: "admin", happened_at: "2026-07-06T08:45:00Z" },
      { id: "u-drive", well_id: "w1", source: "drive", happened_at: "2026-07-06T08:10:00Z" },
    ];
    const plan = planSync(ROOT, files, [{ ...kyabirwa, drive_folder_id: "f1" }], [], updates);
    expect(plan.newUpdates).toHaveLength(0);
    expect(plan.attachToExisting).toEqual([expect.objectContaining({ update_id: "u-drive" })]);
  });

  it("detects renames and deletions, and leaves unchanged files alone", () => {
    const files = [
      folder("f1", "UG-2026-014 · Kyabirwa"),
      photo("p1", "f1", "2026-07-06T08:10:00Z", "renamed.jpg"),
      photo("p2", "f1", "2026-07-06T08:20:00Z"),
    ];
    const media: DbMedia[] = [
      { id: "m1", update_id: "u1", well_id: "w1", drive_file_id: "p1", name: "p1.jpg", drive_modified_at: "2026-07-06T08:10:00Z" },
      { id: "m2", update_id: "u1", well_id: "w1", drive_file_id: "p2", name: "p2.jpg", drive_modified_at: "2026-07-06T08:20:00Z" },
      { id: "m3", update_id: "u1", well_id: "w1", drive_file_id: "gone", name: "gone.jpg", drive_modified_at: null },
    ];
    const plan = planSync(ROOT, files, [{ ...kyabirwa, drive_folder_id: "f1" }], media, []);
    expect(plan.renamed).toEqual([{ id: "m1", name: "renamed.jpg", drive_modified_at: "2026-07-06T08:10:00Z" }]);
    expect(plan.deleteMediaIds).toEqual(["m3"]);
    expect(plan.newUpdates).toHaveLength(0);
    expect(plan.attachToExisting).toHaveLength(0);
  });

  it("reports root folders that match no well, and ignores loose root files and Google Docs", () => {
    const files = [
      folder("f-x", "Old photos"),
      folder("f1", "UG-2026-014 · Kyabirwa"),
      photo("loose", ROOT, "2026-07-06T08:10:00Z"),
      { ...photo("doc", "f1", "2026-07-06T08:10:00Z"), mimeType: "application/vnd.google-apps.document" },
    ];
    const plan = planSync(ROOT, files, [kyabirwa], [], []);
    expect(plan.unmatchedFolders).toEqual([{ id: "f-x", name: "Old photos" }]);
    expect(plan.newUpdates).toHaveLength(0);
  });

  it("falls back to createdTime when there is no EXIF time (WhatsApp strips it)", () => {
    const f: DriveFile = { id: "p", name: "WA.jpg", mimeType: "image/jpeg", parents: ["f1"], createdTime: "2026-09-05T02:00:00Z", modifiedTime: "2026-09-05T02:00:00Z" };
    const plan = planSync(ROOT, [folder("f1", "UG-2026-014"), f], [{ ...kyabirwa, drive_folder_id: "f1" }], [], []);
    expect(plan.newUpdates[0].media[0].taken_at).toBe("2026-09-05T02:00:00Z");
    expect(plan.newUpdates[0].stage).toBe("drilling"); // handover not yet reached in fixture
  });
});
