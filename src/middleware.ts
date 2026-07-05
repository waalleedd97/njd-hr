import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  // Inject pathname header so RSC layouts can read it via headers().
  res.headers.set("x-pathname", req.nextUrl.pathname);

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
          res = NextResponse.next({ request: req });
          res.headers.set("x-pathname", req.nextUrl.pathname);
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
