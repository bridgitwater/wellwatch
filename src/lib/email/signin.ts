import "server-only";
import { signInLink, LINK_LIFETIME } from "../auth/links";
import { sendEmail } from "./send";

/**
 * The sign-in email for /login. WellWatch sends it itself (through Resend) rather than
 * through Supabase, so the link goes to the button-press /auth/confirm page (safe from
 * mail scanners) and isn't bound by Supabase's 30-emails-an-hour project allowance.
 * Design matches supabase/email-templates/magic-link.html.
 */
export async function sendSignInEmail(email: string, next: string) {
  const href = await signInLink(email, next);
  const a = href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f7f8;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#16232b;-webkit-font-smoothing:antialiased">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f8">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
            <tr>
              <td style="padding:0 4px 14px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#17607d;font-weight:700">
                Bridgit Water &middot; WellWatch
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #dbe4e8;border-radius:14px;padding:32px 28px">
                <h1 style="margin:0 0 10px;font-size:26px;line-height:1.2;font-weight:700;color:#16232b">Sign in to WellWatch</h1>
                <p style="margin:0 0 22px;font-size:16px;line-height:1.55;color:#51666f">
                  Here&rsquo;s your one-tap link to see your well &mdash; the progress, the photos from the field and the people it serves.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px">
                  <tr>
                    <td style="background:#17607d;border-radius:10px">
                      <a href="${a}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">Sign in to WellWatch</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 6px;font-size:14px;line-height:1.55;color:#51666f">
                  The link works once and expires in ${LINK_LIFETIME}. If it&rsquo;s stopped working, just request a new one from the sign-in page.
                </p>
                <p style="margin:0;font-size:14px;line-height:1.55;color:#51666f">
                  Didn&rsquo;t ask for this? You can safely ignore this email &mdash; nothing happens unless the link is opened.
                </p>
                <hr style="border:0;border-top:1px solid #dbe4e8;margin:24px 0 16px">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#66787f">
                  Button not working? <a href="${a}" style="color:#17607d;font-weight:600">Use this sign-in link instead</a>,
                  or reply to this email and we&rsquo;ll help.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 4px 0;font-size:12px;line-height:1.6;color:#66787f">
                Bridgit Water Foundation &middot; Australian charity &middot;
                <a href="https://bridgitwater.org" style="color:#66787f">bridgitwater.org</a><br>
                Questions? Write to <a href="mailto:wellwatch@bridgitwater.org" style="color:#66787f">wellwatch@bridgitwater.org</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = `Sign in to WellWatch\n\nYour one-tap sign-in link (works once, expires in ${LINK_LIFETIME}):\n${href}\n\nDidn't ask for this? You can safely ignore this email.`;
  await sendEmail(email, "Your WellWatch sign-in link", html, text);
}
