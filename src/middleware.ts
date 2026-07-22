import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  // Inject pathname as a REQUEST header — a response header is invisible to
  // Server Components; headers() in the root layout only sees request headers
  // forwarded via NextResponse.next({ request: { headers } }).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);

  let res = NextResponse.next({ request: { headers: requestHeaders } });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return res;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            req.cookies.set(name, value);
          }
          // Rebuild the cookie request header so downstream RSCs (layout's
          // getServerUser) see the refreshed session in this same request.
          requestHeaders.set(
            "cookie",
            req.cookies
              .getAll()
              .map((c) => `${c.name}=${c.value}`)
              .join("; ")
          );
          res = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options);
          }
        },
      },
    });

    const { data } = await supabase.auth.getUser();

    // Cross-subdomain fallback: no sb-* session but njd-rt cookie exists.
    if (!data.user) {
      const njdRt = req.cookies.get("njd-rt")?.value;
      if (njdRt) {
        try {
          await supabase.auth.refreshSession({ refresh_token: njdRt });
        } catch {
          // Swallow — page-level auth will redirect if needed.
        }
      }
    }
  } catch {
    // Never let middleware failures 500 the whole app.
  }

  return res;
}

export const config = {
  matcher: [
    // All app routes EXCEPT static assets, API routes, and files with extensions.
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\..*).*)",
  ],
};
