/**
 * Lightweight observability layer.
 *
 * If `NEXT_PUBLIC_SENTRY_DSN` is set, errors/events are forwarded to Sentry's
 * HTTP ingestion endpoint directly — this avoids pulling in the heavy
 * @sentry/nextjs SDK when it's not configured.
 *
 * When no DSN is set, every function is a no-op, so it is safe to call
 * `reportError` / `reportEvent` unconditionally from application code.
 */

interface SentryDsnParts {
  host: string;
  projectId: string;
  publicKey: string;
}

function parseDsn(dsn: string): SentryDsnParts | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    const publicKey = u.username;
    if (!projectId || !publicKey) return null;
    return { host: u.host, projectId, publicKey };
  } catch {
    return null;
  }
}

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const PARSED = DSN ? parseDsn(DSN) : null;
const ENV = process.env.NODE_ENV || "development";
const RELEASE = process.env.NEXT_PUBLIC_APP_VERSION || "dev";

function sentryEndpoint(parts: SentryDsnParts): string {
  return `https://${parts.host}/api/${parts.projectId}/store/?sentry_key=${parts.publicKey}&sentry_version=7`;
}

function pii(): { ip_address: string } | undefined {
  // Never include user-identifying data by default. Caller can enrich if desired.
  return undefined;
}

async function send(payload: Record<string, unknown>): Promise<void> {
  if (!PARSED || typeof window === "undefined") return;
  try {
    await fetch(sentryEndpoint(PARSED), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        environment: ENV,
        release: RELEASE,
        platform: "javascript",
        user: pii(),
      }),
      keepalive: true,
    });
  } catch {
    // Swallow — observability must never crash the app.
  }
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!PARSED) return;
  const err = error instanceof Error ? error : new Error(String(error));
  void send({
    level: "error",
    message: err.message,
    exception: {
      values: [{
        type: err.name,
        value: err.message,
        stacktrace: err.stack ? { frames: parseStack(err.stack) } : undefined,
      }],
    },
    tags: { component: "hr-app" },
    extra: context,
  });
}

export function reportEvent(name: string, data?: Record<string, unknown>): void {
  if (!PARSED) return;
  void send({
    level: "info",
    message: name,
    tags: { component: "hr-app", event: name },
    extra: data,
  });
}

function parseStack(stack: string): Array<{ function: string; filename?: string; lineno?: number }> {
  return stack
    .split("\n")
    .slice(1, 20) // cap frame count
    .map((line) => {
      const m = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (m) {
        return { function: m[1], filename: m[2], lineno: parseInt(m[3], 10) };
      }
      return { function: line.trim() };
    });
}

export const observability = { reportError, reportEvent, enabled: !!PARSED };
