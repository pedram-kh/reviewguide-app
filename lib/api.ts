import "server-only";

/**
 * Server-only fetch wrapper to the FastAPI backend (SPRINT_03.md ticket 3.2).
 *
 * `import "server-only"` makes any accidental import of this file from a Client Component fail
 * the build, rather than silently bundling ADMIN_API_KEY into JS shipped to the browser. The
 * real flow is always: browser -> Next.js Server Component -> this file -> FastAPI. The key is
 * read from env at request time (never exposed via NEXT_PUBLIC_*).
 */

export interface StatsResponse {
  by_status: Record<string, number>;
  sent_today: number;
  sent_by_channel: Record<string, number>;
  replies: number;
}

async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const backendUrl = process.env.BACKEND_URL;
  const adminApiKey = process.env.ADMIN_API_KEY;
  if (!backendUrl || !adminApiKey) {
    throw new Error("BACKEND_URL and ADMIN_API_KEY must be set in the server environment");
  }

  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      "X-Admin-Key": adminApiKey,
      ...init?.headers,
    },
    // Admin data (stats, lead statuses) must always be current — never serve a stale cache.
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend request to ${path} failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
}

export function getStats(): Promise<StatsResponse> {
  return backendFetch<StatsResponse>("/api/admin/stats");
}
