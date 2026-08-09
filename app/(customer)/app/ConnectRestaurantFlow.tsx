"use client";

import { useEffect, useRef, useState } from "react";

import type { ConnectPlaceResult, SearchPlaceResult } from "@/lib/customerApi";
import { readJson } from "@/lib/readJson";
import { DARK_GLASS_CARD } from "@/lib/theme";

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
      <div className={`${DARK_GLASS_CARD} w-full max-w-lg p-6`}>
        <p className="text-sm text-white/60">Potwierdź restaurację</p>
        <p className="mt-2 text-lg font-semibold text-white">{pending.name ?? "Nieznana nazwa"}</p>
        {pending.source === "search" ? (
          <>
            {pending.address && <p className="mt-1 text-sm text-white/60">{pending.address}</p>}
            {pending.rating != null && (
              <p className="mt-1 text-sm text-white/60">★ {pending.rating.toFixed(1)}</p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-white/60">
            Adres i ocena pojawią się zaraz po połączeniu.
          </p>
        )}

        {connectError && (
          <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {connectError}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={confirmConnect}
            disabled={connecting}
            className="flex-1 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {connecting ? "Łączenie…" : "Połącz"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPending(null);
              setConnectError(null);
            }}
            disabled={connecting}
            className="rounded-full border border-white/15 px-4 py-2.5 text-sm text-white transition-colors hover:border-white/30 disabled:opacity-50"
          >
            Wróć
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${DARK_GLASS_CARD} w-full max-w-lg p-6`}>
      <p className="text-sm text-white/60">Połącz restaurację</p>
      <p className="mt-2 text-lg font-semibold text-white">Nie masz jeszcze połączonej restauracji</p>
      <p className="mt-1 text-sm text-white/60">
        Wyszukaj ją poniżej albo wklej link z Google Maps — a my znajdziemy jej najnowsze recenzje.
      </p>

      <div className="mt-5 flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`rounded-full px-3 py-1.5 transition-colors ${
            mode === "search" ? "bg-white text-black" : "border border-white/15 text-white/70 hover:border-white/30"
          }`}
        >
          Wyszukaj
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`rounded-full px-3 py-1.5 transition-colors ${
            mode === "url" ? "bg-white text-black" : "border border-white/15 text-white/70 hover:border-white/30"
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
            className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
          />

          {searchLoading && <p className="mt-3 text-sm text-white/50">Szukam…</p>}
          {visibleError && (
            <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {visibleError}
            </p>
          )}
          {!searchLoading && !visibleError && visibleHasSearched && visibleResults.length === 0 && (
            <p className="mt-3 text-sm text-white/50">
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
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-white transition-colors hover:border-white/25 hover:bg-white/[0.06]"
                  >
                    <span className="font-medium">{result.name ?? "Nieznana nazwa"}</span>
                    {result.address && <span className="block text-xs text-white/50">{result.address}</span>}
                    {result.rating != null && (
                      <span className="mt-0.5 block text-xs text-white/50">★ {result.rating.toFixed(1)}</span>
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
            className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={checkMapsUrl}
            disabled={urlLoading || !mapsUrl.trim()}
            className="mt-3 w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {urlLoading ? "Sprawdzam…" : "Sprawdź link"}
          </button>
          {urlError && (
            <p className="mt-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {urlError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
