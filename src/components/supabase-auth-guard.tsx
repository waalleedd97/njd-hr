"use client";

import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { type Session } from "@supabase/supabase-js";
import { AUTH_TIMEOUT_MS } from "@/lib/constants";

const REDIRECT_URL = "https://njd-services.net";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

export function SupabaseAuthGuard({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Step 1: Check URL hash for access_token + refresh_token
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      }

      // Step 2: Try to get existing session
      let session: Session | null = null;
      const { data } = await supabase.auth.getSession();
      session = data.session;

      // Step 3: If no session, try restoring from the shared njd-rt cookie
      if (!session) {
        const cookieRT = getCookie("njd-rt");
        if (cookieRT) {
          const { data: refreshData } = await supabase.auth.refreshSession({
            refresh_token: cookieRT,
          });
          session = refreshData.session;
        }
      }

      // Step 4: Still no session — wait for onAuthStateChange as last resort
      if (!session) {
        session = await new Promise<Session | null>((resolve) => {
          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange((_event, s) => {
            subscription.unsubscribe();
            resolve(s);
          });
          setTimeout(() => {
            subscription.unsubscribe();
            resolve(null);
          }, AUTH_TIMEOUT_MS);
        });
      }

      // Step 5: No session after all attempts — redirect to login
      if (!session) {
        if (!cancelled) window.location.href = REDIRECT_URL;
        return;
      }

      // Step 6: Check app access — fail-closed: only allow on explicit true
      let hasAccessGranted = false;
      try {
        const { data: hasAccess, error } = await supabase.rpc("has_app_access", {
          uid: session.user.id,
          app: "hr",
        });

        if (error) {
          console.error("[auth-guard] has_app_access RPC error:", error.message);
        } else if (hasAccess === true) {
          hasAccessGranted = true;
        }
      } catch (err) {
        console.error("[auth-guard] has_app_access RPC threw:", err);
      }

      if (!hasAccessGranted) {
        if (!cancelled) {
          window.location.href =
            REDIRECT_URL +
            "?error=" +
            encodeURIComponent("ليس لديك صلاحية للوصول إلى HR");
        }
        return;
      }

      if (!cancelled) setReady(true);
    }

    init();

    // Listen for sign-out after initial auth resolves
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
        window.location.href = REDIRECT_URL;
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!ready) return null;

  return <>{children}</>;
}
