import { ActionForm } from "@/components/admin/action-form";
import { Button, Card, Field, Input } from "@/components/admin/ui";
import { LocalTime } from "@/components/local-time";
import { requireAdmin } from "@/lib/admin/guard";
import { addTeamMember, removeTeamMember, resendTeamLink } from "@/lib/admin/team-actions";
import { SIGNIN_OUTCOME } from "@/lib/email/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const since = new Date(new Date().getTime() - 14 * 24 * 3600 * 1000).toISOString();
  const [admins, misses] = await Promise.all([
    supabase.from("profiles").select("id, email, display_name, notify_email").eq("role", "admin").order("created_at"),
    supabase.from("signin_attempts").select("id, email, outcome, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(100),
  ]);

  // Sign-in state lives in auth.users, which only the service role can read.
  const db = createAdminClient();
  const team = await Promise.all(
    (admins.data ?? []).map(async (p) => {
      const { data } = await db.auth.admin.getUserById(p.id);
      return { ...p, confirmed: Boolean(data.user?.email_confirmed_at), lastSignIn: data.user?.last_sign_in_at ?? null };
    }),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6 min-w-0">
        {(admins.error || misses.error) && (
          <p className="rounded-lg bg-clay-soft text-clay px-4 py-3 text-sm">Couldn&apos;t load everything on this page: {admins.error?.message ?? misses.error?.message}. Try reloading.</p>
        )}
        <Card title={`Admins (${team.length})`}>
          <ul className="flex flex-col divide-y divide-line -my-2 text-sm">
            {team.map((t) => (
              <li key={t.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{t.display_name ?? t.email}{t.id === me.id && <span className="ml-1 text-xs text-ink-3 font-normal">you</span>}</div>
                  <div className="text-xs text-ink-2 truncate">{t.email}</div>
                  <div className="text-xs text-ink-3">
                    {t.lastSignIn ? <>Last signed in <LocalTime iso={t.lastSignIn} /></> : t.confirmed ? "Hasn't signed in yet" : "Hasn't signed in yet · the next link will confirm their email"}
                    {t.notify_email ? " · gets the daily digest" : " · digest off"}
                  </div>
                </div>
                <ActionForm action={resendTeamLink} confirm={`Email ${t.email} a new sign-in link? Any earlier link stops working.`} className="flex flex-col items-end gap-1">
                  <input type="hidden" name="id" value={t.id} />
                  <Button variant="ghost" type="submit">Send sign-in link</Button>
                </ActionForm>
                {t.id !== me.id && (
                  <ActionForm action={removeTeamMember} confirm={`Remove admin access for ${t.email}? They keep any wells they funded, as a funder.`} className="flex flex-col items-end gap-1">
                    <input type="hidden" name="id" value={t.id} />
                    <Button variant="danger" type="submit">Remove</Button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Sign-in requests that didn't get a link (last 14 days)">
          {misses.error ? (
            <p className="text-sm text-clay">Couldn&apos;t load sign-in requests.</p>
          ) : (misses.data ?? []).length === 0 ? (
            <p className="text-sm text-ink-2">None. Everyone who asked for a sign-in link got one.</p>
          ) : (
            <>
              <p className="text-sm text-ink-2 mb-3">
                The sign-in page always says a link is on its way, so strangers can&apos;t test which emails we hold. These are the requests where nothing was sent.
                Most are funders using a different email from the one on file: link the email they used to their well (and remove the old one), then ask them to try again.
              </p>
              <ul className="flex flex-col divide-y divide-line text-sm">
                {(misses.data ?? []).map((m) => (
                  <li key={m.id} className="py-2 flex flex-wrap justify-between gap-2">
                    <span className="font-medium break-all">{m.email}</span>
                    <span className="text-ink-2 text-xs">{SIGNIN_OUTCOME[m.outcome] ?? m.outcome} · <LocalTime iso={m.created_at} /></span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card title="Add an admin">
        <ActionForm action={addTeamMember} resetOnSuccess className="flex flex-col gap-3">
          <Field label="Email"><Input name="email" type="email" required placeholder="name@bridgitwater.org" /></Field>
          <Field label="Name" hint="Used to greet them."><Input name="display_name" placeholder="Carla Martinez" /></Field>
          <Button type="submit">Add and send welcome email</Button>
        </ActionForm>
        <p className="text-xs text-ink-3 mt-4">
          Admins can see and edit every well, funder and partner. They get a welcome email with a sign-in link that works for an hour; after that they sign in at the
          normal sign-in page with this email. No passwords.
        </p>
      </Card>
    </div>
  );
}
