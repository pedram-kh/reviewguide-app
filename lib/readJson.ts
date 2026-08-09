/**
 * Guarded response-body parsing for browser-side fetches.
 *
 * Deliberately NOT `"server-only"`: this is imported by client components. The server-side clients
 * (`lib/api.ts`, `lib/customerApi.ts`, `lib/authApi.ts`, `lib/billingApi.ts`) each already read
 * `text()` and parse in a try/catch; this is the same discipline for the code that runs in the
 * browser, where the failure is visible to a person instead of a log line.
 *
 * Why it exists (ticket 6.1, generalized in 6.2): calling `response.json()` — especially before
 * checking `response.ok` — throws a raw `SyntaxError` whenever the body is not JSON. Anything
 * between the browser and this app can produce a non-JSON body: Netlify answers with an HTML error
 * page when a route handler exceeds its function timeout, which is exactly what happened on the
 * live connect that opened 6.1. The customer was shown
 * `Unexpected token '<', "<HTML> <HE"... is not valid JSON` for a connect that had actually
 * succeeded. 6.1 removed that specific timeout but not the general possibility, so every browser
 * fetch parses through here.
 */

/** Customer-facing surfaces are Polish; the tone matches the rest of `app/(customer)`. */
export const UNEXPECTED_RESPONSE_PL =
  "Serwer zwrócił nieoczekiwaną odpowiedź. Odśwież stronę, aby sprawdzić aktualny stan.";

/** `/admin` is operator-facing and English throughout. */
export const UNEXPECTED_RESPONSE_EN =
  "The server returned an unexpected response (not JSON). Reload to see the current state.";

/**
 * Reads a response body as JSON, or throws an `Error` whose message is a sentence worth showing.
 *
 * The contract that matters: this never calls `response.json()`, and it decides whether the body
 * parsed *before* it looks at the status. So a non-JSON body can never escape as a `SyntaxError`,
 * whichever order the caller checks things in.
 *
 * - Unparseable body → `unexpectedMessage` (with the status appended when the request also failed,
 *   since "502" is the one useful detail an HTML error page still carries).
 * - Parsed, but `!response.ok` → the API's own `detail` string when there is one (FastAPI's
 *   convention, and those messages are written to be read), otherwise `fallbackMessage`.
 * - Parsed and ok → the body, typed.
 *
 * An empty body counts as unparseable rather than as `null`: every endpoint here answers with a
 * JSON object, so a blank body means something upstream truncated the response.
 */
export async function readJson<T>(
  response: Response,
  fallbackMessage: string,
  unexpectedMessage: string = UNEXPECTED_RESPONSE_PL
): Promise<T> {
  const raw = await response.text();
  let data: { detail?: unknown } | null = null;
  try {
    data = raw ? (JSON.parse(raw) as { detail?: unknown }) : null;
  } catch {
    data = null;
  }

  if (data === null) {
    throw new Error(response.ok ? unexpectedMessage : `${unexpectedMessage} (${response.status})`);
  }
  if (!response.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : fallbackMessage);
  }
  return data as T;
}
