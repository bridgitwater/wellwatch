"use client";

import { makeDriveFoldersPrivate } from "@/lib/admin/actions";
import { ActionForm } from "./action-form";
import { Button } from "./ui";

const ONE = "Make one ready well folder private, as a test?\n\nIts photos stay visible on WellWatch. Check its page afterwards, then do the rest.";
const ALL = "Make the well folders in the Wells drive private?\n\nFunders keep seeing what they see now. People outside Bridgit who were given a folder link will lose access; staff need to be members of the Wells shared drive to open folders.";

/** The two Drive-privacy buttons (client side, so the confirm question can depend on which was pressed). */
export function DrivePrivacyButtons({ ready }: { ready: boolean }) {
  return (
    <ActionForm action={makeDriveFoldersPrivate} className="mt-3 flex flex-col gap-2" confirm={(fd) => (fd.get("max") === "1" ? ONE : ALL)}>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="max" value="1" variant="ghost">Try one folder first</Button>
        <Button type="submit" name="max" value="all" variant={ready ? "primary" : "ghost"}>Make all folders private</Button>
      </div>
    </ActionForm>
  );
}
