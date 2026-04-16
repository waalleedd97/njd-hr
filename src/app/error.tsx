"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[HR] Route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface-container-lowest rounded-2xl shadow-sm p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-error-container/20 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-md-error"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 className="font-headline text-xl font-extrabold text-on-surface">
          حدث خطأ غير متوقع
        </h2>

        <p className="text-sm text-on-surface-variant">
          An unexpected error occurred. Please try again — if the problem persists, contact IT support.
        </p>

        {error.digest && (
          <p className="text-xs font-mono text-on-surface-variant/60 break-all">
            ref: {error.digest}
          </p>
        )}

        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={reset}
            className="px-5 py-2 rounded-xl gradient-btn text-white font-bold text-sm"
          >
            إعادة المحاولة / Retry
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="px-5 py-2 rounded-xl bg-surface-container-high text-on-surface font-bold text-sm"
          >
            الصفحة الرئيسية / Home
          </button>
        </div>
      </div>
    </div>
  );
}
