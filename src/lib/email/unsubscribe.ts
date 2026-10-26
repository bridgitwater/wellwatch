import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { APP_URL, esc } from "./send";

/**
 * Signed one-click unsubscribe links. The token is an HMAC of the person's profile
 * id, so a link only ever turns off that one person's emails and can't be guessed.
 * The key is derived from the service-role key, which already never leaves the
 * server; rotating that key retires old links (people can still turn emails off
 * from their wells page).
 */
function key() {
  const secret = process.env.UNSUBSCRIBE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("No secret for unsubscribe links");
  return createHmac("sha256", secret).update("wellwatch-unsubscribe-v1").digest();
}

export function unsubscribeToken(profileId: string): string {
  return createHmac("sha256", key()).update(profileId).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribe(profileId: string, token: string): boolean {
  if (!/^[0-9a-f-]{36}$/i.test(profileId) || !token) return false;
  const want = Buffer.from(unsubscribeToken(profileId));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** The page people land on from the link in the email (it asks before changing anything). */
export function unsubscribeUrl(profileId: string): string {
  return `${APP_URL}/unsubscribe?u=${profileId}&t=${unsubscribeToken(profileId)}`;
}

/** The endpoint mail apps call for one-click unsubscribe (RFC 8058: a POST, never a GET). */
export function oneClickUrl(profileId: string): string {
  return `${APP_URL}/api/unsubscribe?u=${profileId}&t=${unsubscribeToken(profileId)}`;
}

/** Headers that give Gmail, Outlook and Apple Mail their own "Unsubscribe" button. */
export function unsubscribeHeaders(profileId: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${oneClickUrl(profileId)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Footer for every email to a funder (or an admin's digest): why they get it, and a way out. */
export function emailFooter(profileId: string, why: string): string {
  return `${esc(why)} <a href="${unsubscribeUrl(profileId)}" style="color:#66787f">Unsubscribe</a> from WellWatch emails, or change this any time from <a href="${APP_URL}/wells" style="color:#66787f">your wells page</a>.`;
}
