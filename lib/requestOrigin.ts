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

/**
 * A second, independent Netlify quirk found alongside the host one, and this one is *documented*
 * platform behavior rather than a bug: Netlify auto-propagates the original request's query
 * string onto any redirect Location that has none of its own (see
 * github.com/opennextjs/opennextjs-netlify/issues/2209 and Netlify's own support guide on
 * redirects + query strings). Verified live: hitting `/auth/verify?token=X` and redirecting to a
 * clean `/app` got the spent one-time token re-appended as `/app?token=X` — visible in browser
 * history/referrers even though the token can't be reused. Targets that already carry their own
 * query (e.g. `/login?error=invalid_link`) are unaffected, confirmed live — only ones with an
 * empty query need this. The documented workaround is exactly what it sounds like: give the
 * target a query param of our own so there's nothing for Netlify to substitute.
 */
export function withNetlifyRedirectSafety(url: URL): URL {
  if ([...url.searchParams.keys()].length === 0) {
    url.searchParams.set("_r", "1");
  }
  return url;
}
