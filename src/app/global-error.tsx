"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/observability";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[HR] Global error (root layout crashed):", error);
    reportError(error, { scope: "global", digest: error.digest });
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#0a0a1a",
          color: "#fff",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
            خطأ جسيم في التطبيق
          </h1>
          <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 24 }}>
            A critical application error occurred. Please reload the page.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 11,
                opacity: 0.5,
                marginBottom: 16,
                fontFamily: "monospace",
                wordBreak: "break-all",
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: "linear-gradient(135deg,#8B5CF6,#5B21B6)",
              color: "#fff",
              border: "none",
              padding: "10px 24px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            إعادة التحميل / Reload
          </button>
        </div>
      </body>
    </html>
  );
}
