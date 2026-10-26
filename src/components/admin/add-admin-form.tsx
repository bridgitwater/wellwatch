"use client";

import { addTeamMember } from "@/lib/admin/team-actions";
import { ActionForm } from "./action-form";
import { Button, Field, Input } from "./ui";

/** Asks before making someone an admin, and warns when the address isn't a Bridgit one (a typo'd domain could belong to anyone). */
function question(fd: FormData): string {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const outside = !email.endsWith("@bridgitwater.org");
  return `Make ${email} a WellWatch admin?\n\nAdmins can see and change every well, funder and partner.${
    outside ? `\n\nThis address isn't on bridgitwater.org. Check the spelling carefully: a mistyped address could belong to a stranger.` : ""
  }`;
}

export function AddAdminForm() {
  return (
    <ActionForm action={addTeamMember} resetOnSuccess confirm={question} className="flex flex-col gap-3">
      <Field label="Email"><Input name="email" type="email" required placeholder="name@bridgitwater.org" /></Field>
      <Field label="Name" hint="Used to greet them."><Input name="display_name" placeholder="Carla Martinez" /></Field>
      <Button type="submit">Add and send welcome email</Button>
    </ActionForm>
  );
}
