import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";

/**
 * Refreshes the Supabase session cookie on every request and sends
 * signed-out visitors on protected paths to /login.
 */
export async function proxy(request: NextRequest) {
  // Local UI preview without Supabase (see src/lib/fixtures.ts).
  if (process.env.WELLWATCH_FIXTURES === "1" && process.env.NODE_ENV !== "production") {
    return NextResponse.next({ request });
  }
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims validates the JWT locally (no network round-trip on every request).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isProtected = pathname.startsWith("/wells") || pathname.startsWith("/admin");

  if (isProtected && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  // A "link expired" notice is shown even when signed in, so the person can ask for their own link.
  if (pathname === "/login" && signedIn && !request.nextUrl.searchParams.has("error")) {
    // Already signed in: go where the link asked, or for the default, to /admin for staff.
    let dest = safeNext(request.nextUrl.searchParams.get("next"));
    if (dest === "/wells") {
      const { data: me } = await supabase.from("profiles").select("role").eq("id", String(data?.claims?.sub ?? "")).maybeSingle();
      if (me?.role === "admin") dest = "/admin";
    }
    const target = new URL(dest, request.nextUrl.origin);
    const url = request.nextUrl.clone();
    url.pathname = target.pathname;
    url.search = target.search;
    url.hash = target.hash;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and the cron endpoints (those use a bearer secret).
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
