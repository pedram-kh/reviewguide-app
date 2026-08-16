"use client";

import { useEffect, useRef, useState } from "react";

import type { ConnectPlaceResult, SearchPlaceResult } from "@/lib/customerApi";
import { readJson } from "@/lib/readJson";
import { CUSTOMER_CARD } from "@/lib/theme";

const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

type PendingConnect =
  | { source: "search"; place_id: string; name: string | null; address: string | null; rating: number | null }
  | { source: "url"; place_id: string; maps_url: string; name: string | null };

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJson<T>(response, `Błąd (${response.status})`);
}

/**
 * Ticket 5.3's "connect-restaurant flow": a search box with live results, a "wklej link"
 * fallback for pasting a Google Maps share link, and a confirmation card before the actual
 * connect (POST /api/customer/connect-place) fires. Nothing here bills anything twice — the
 * search results and URL preview are shown for confirmation only; the final "Połącz" click
 * sends the same payload the backend needs to do the real work exactly once.
 */
export function ConnectRestaurantFlow({
  onConnected,
}: {
  onConnected: (result: ConnectPlaceResult) => void;
}) {
  const [mode, setMode] = useState<"search" | "url">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPlaceResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [mapsUrl, setMapsUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingConnect | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimmedQuery = query.trim();
  const isQueryLongEnough = trimmedQuery.length >= MIN_QUERY_LENGTH;
  // Derived rather than reset via setState in the effect below: once the query drops back below
  // the minimum length, the previous results/error/hasSearched simply stop being shown, without
  // needing a synchronous setState call in the effect body for that branch.
  const visibleResults = isQueryLongEnough ? results : [];
  const visibleError = isQueryLongEnough ? searchError : null;
  const visibleHasSearched = isQueryLongEnough && hasSearched;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isQueryLongEnough) return;

    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const response = await fetch(`/api/customer/search-place?q=${encodeURIComponent(trimmedQuery)}`);
        const data = await readJson<{ results: SearchPlaceResult[] }>(
          response,
          "Wyszukiwanie nie powiodło się."
        );
        setResults(data.results);
      } catch (err) {
        setSearchError(err instanceof Error ? err.message : "Wyszukiwanie nie powiodło się.");
        setResults([]);
      } finally {
        setSearchLoading(false);
        setHasSearched(true);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmedQuery, isQueryLongEnough]);

  async function checkMapsUrl() {
    if (!mapsUrl.trim()) return;
    setUrlLoading(true);
    setUrlError(null);
    try {
      const preview = await postJson<{ place_id: string | null; suggested_query: string | null }>(
        "/api/customer/preview-maps-url",
        { maps_url: mapsUrl.trim() }
      );
      if (preview.place_id) {
        setPending({
          source: "url",
          place_id: preview.place_id,
          maps_url: mapsUrl.trim(),
          name: preview.suggested_query,
        });
      } else if (preview.suggested_query) {
        setUrlError(
          `Nie udało się jednoznacznie rozpoznać linku. Spróbuj wyszukać: „${preview.suggested_query}”.`
        );
        setMode("search");
        setQuery(preview.suggested_query);
      } else {
        setUrlError("Nie udało się rozpoznać tego linku. Skorzystaj z wyszukiwania powyżej.");
      }
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "Nie udało się sprawdzić linku.");
    } finally {
      setUrlLoading(false);
    }
  }

  async function confirmConnect() {
    if (!pending) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const body =
        pending.source === "search"
          ? {
              place_id: pending.place_id,
              name: pending.name,
              address: pending.address,
              rating: pending.rating,
            }
          : { maps_url: pending.maps_url };
      const result = await postJson<ConnectPlaceResult>("/api/customer/connect-place", body);
      onConnected(result);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Nie udało się połączyć restauracji.");
    } finally {
      setConnecting(false);
    }
  }

  if (pending) {
    return (
      <div className={`${CUSTOMER_CARD} w-full max-w-lg p-6`}>
        <p className="text-sm text-ink-soft">Potwierdź restaurację</p>
        <p className="mt-2 text-lg font-semibold text-ink">{pending.name ?? "Nieznana nazwa"}</p>
        {pending.source === "search" ? (
          <>
            {pending.address && <p className="mt-1 text-sm text-ink-soft">{pending.address}</p>}
            {pending.rating != null && (
              <p className="mt-1 text-sm text-ink-soft">★ {pending.rating.toFixed(1)}</p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">
            Adres i ocena pojawią się zaraz po połączeniu.
          </p>
        )}

        {connectError && (
          <p className="mt-4 rounded-lg border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose-ink">
            {connectError}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={confirmConnect} disabled={connecting} className="btn btn-primary flex-1">
            {connecting ? "Łączenie…" : "Połącz"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPending(null);
              setConnectError(null);
            }}
            disabled={connecting}
            className="btn btn-ghost"
          >
            Wróć
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${CUSTOMER_CARD} w-full max-w-lg p-6`}>
      <p className="text-sm text-ink-soft">Połącz restaurację</p>
      <p className="mt-2 text-lg font-semibold text-ink">Nie masz jeszcze połączonej restauracji</p>
      <p className="mt-1 text-sm text-ink-soft">
        Wyszukaj ją poniżej albo wklej link z Google Maps — a my znajdziemy jej najnowsze recenzje.
      </p>

      {/* #3a2600 (not text-white — 2.07:1 on gold-deep, fails AA) matches btn-primary's dark-ink-
          on-gold text, computed at 6.96:1. */}
      <div className="mt-5 flex gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`rounded-full px-3 py-1.5 transition-colors ${
            mode === "search" ? "bg-gold-deep text-[#3a2600]" : "border border-line text-ink-soft hover:border-gold-deep/50"
          }`}
        >
          Wyszukaj
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`rounded-full px-3 py-1.5 transition-colors ${
            mode === "url" ? "bg-gold-deep text-[#3a2600]" : "border border-line text-ink-soft hover:border-gold-deep/50"
          }`}
        >
          Wklej link
        </button>
      </div>

      {mode === "search" ? (
        <div className="mt-4">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nazwa restauracji, np. Bar Warszawski"
            className="rg-input"
          />

          {searchLoading && <p className="mt-3 text-sm text-ink-soft">Szukam…</p>}
          {visibleError && (
            <p className="mt-3 rounded-lg border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose-ink">
              {visibleError}
            </p>
          )}
          {!searchLoading && !visibleError && visibleHasSearched && visibleResults.length === 0 && (
            <p className="mt-3 text-sm text-ink-soft">
              Brak wyników. Spróbuj innej nazwy albo wklej link z Google Maps.
            </p>
          )}

          {visibleResults.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {visibleResults.map((result) => (
                <li key={result.place_id}>
                  <button
                    type="button"
                    onClick={() =>
                      setPending({
                        source: "search",
                        place_id: result.place_id,
                        name: result.name,
                        address: result.address,
                        rating: result.rating,
                      })
                    }
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-left text-sm text-ink transition-colors hover:border-gold-deep/50 hover:bg-cream-2/60"
                  >
                    <span className="font-medium">{result.name ?? "Nieznana nazwa"}</span>
                    {result.address && <span className="block text-xs text-ink-soft">{result.address}</span>}
                    {result.rating != null && (
                      <span className="mt-0.5 block text-xs text-ink-soft">★ {result.rating.toFixed(1)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <input
            type="text"
            value={mapsUrl}
            onChange={(event) => setMapsUrl(event.target.value)}
            placeholder="https://maps.google.com/..."
            className="rg-input"
          />
          <button
            type="button"
            onClick={checkMapsUrl}
            disabled={urlLoading || !mapsUrl.trim()}
            className="btn btn-primary mt-3 w-full"
          >
            {urlLoading ? "Sprawdzam…" : "Sprawdź link"}
          </button>
          {urlError && (
            <p className="mt-3 rounded-lg border border-rose/30 bg-rose-soft px-3 py-2 text-sm text-rose-ink">
              {urlError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
