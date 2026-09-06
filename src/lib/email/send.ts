import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;
function resend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  return (client ??= new Resend(process.env.RESEND_API_KEY));
}

export const FROM = process.env.EMAIL_FROM ?? "WellWatch <wellwatch@bridgitwater.org>";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  const { error } = await resend().emails.send({ from: FROM, to, subject, html, text });
  if (error) throw new Error(error.message);
}

/** Shared wrapper so every email looks like the portal. Content is plain HTML for maximum client compatibility. */
export function layout(title: string, bodyHtml: string, ctaHref: string, ctaLabel: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f7f8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#16232b">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#17607d;font-weight:600">Bridgit Water · WellWatch</div>
  <h1 style="font-size:24px;margin:8px 0 16px">${esc(title)}</h1>
  <div style="background:#fff;border:1px solid #dbe4e8;border-radius:12px;padding:20px;font-size:15px;line-height:1.55">${bodyHtml}</div>
  <p style="margin:20px 0"><a href="${ctaHref}" style="display:inline-block;background:#17607d;color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:8px">${esc(ctaLabel)}</a></p>
  <p style="font-size:12px;color:#66787f">You're receiving this because you funded a well with Bridgit Water Foundation. <a href="${APP_URL}/wells" style="color:#66787f">Manage notifications</a> from your wells page.</p>
</div></body></html>`;
}

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
