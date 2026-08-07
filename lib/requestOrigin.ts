/**
 * Absolute redirect targets must never be built from `request.url`'s origin on this app —
 * live-verified during ticket 4.2's real-Postmark test: Netlify's Next.js runtime hands route
 * handlers and middleware a `request.url` whose origin is the internal per-deploy URL
 * (`<deploy-id>--dynamic-puppy-631956.netlify.app`), not the public host the browser actually
 * requested. `new URL("/app", request.url)` therefore produces a redirect Location on the wrong
 * host — the session cookie (scoped to the public host that set it) never gets sent there, so the
 * "successful" login silently looks logged-out. Reading the original `Host`/`X-Forwarded-*`
 * headers (standard on every proxy/CDN, Netlify included) instead of trusting the runtime's own
 * URL sidesteps the platform quirk rather than special-casing it. Takes a plain `Request` (rather
 * than `NextRequest`) so it works in both route handlers using the Fetch API `Request` type and
 * ones using `NextRequest`, without needing `nextUrl`.
 */
export function getRequestOrigin(request: Request): string {
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  const protocol =
    request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
