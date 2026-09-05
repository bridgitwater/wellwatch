import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Magic-link landing. Supports both PKCE (?code=) and token-hash (?token_hash=&type=) links. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextRaw = searchParams.get("next") ?? "/wells";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/wells";

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  if (ok) return NextResponse.redirect(`${origin}${next}`);
  if (!code && !tokenHash) {
    // Implicit-flow link: tokens are in the URL fragment, which never reaches the server.
    // Browsers carry the fragment across this redirect; /auth/complete reads it client-side.
    return NextResponse.redirect(`${origin}/auth/complete?next=${encodeURIComponent(next)}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link_expired&next=${encodeURIComponent(next)}`);
}
