"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  createAutocompleteSessionToken,
  fetchPlaceSuggestions,
  isGoogleMapsConfigured,
  resolvePredictionAddress,
  type PlaceSuggestion,
} from "@/lib/maps/places";
import type { ParsedPlaceAddress } from "@/lib/customers/types";

type UseAddressAutocompleteOptions = {
  /** Minimum input length before predictions are requested. */
  minLength?: number;
  /** Debounce delay (ms) for prediction requests. */
  debounceMs?: number;
};

type UseAddressAutocompleteResult = {
  /** Whether Google Places is configured (an API key is present). */
  enabled: boolean;
  suggestions: PlaceSuggestion[];
  isLoading: boolean;
  error: string | null;
  /** Update the query string that drives predictions. */
  setQuery: (value: string) => void;
  /** Resolve a chosen suggestion into a parsed address (components + location). */
  resolveSuggestion: (suggestion: PlaceSuggestion) => Promise<ParsedPlaceAddress | null>;
  /** Clear suggestions and start a fresh billing session. */
  reset: () => void;
};

export function useAddressAutocomplete(
  options: UseAddressAutocompleteOptions = {},
): UseAddressAutocompleteResult {
  const { minLength = 3, debounceMs = 250 } = options;
  const enabled = isGoogleMapsConfigured();

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionTokenRef = useRef<object | undefined>(undefined);
  const requestIdRef = useRef(0);

  const debouncedQuery = useDebouncedValue(query, debounceMs).trim();

  const ensureSessionToken = useCallback(async () => {
    if (!sessionTokenRef.current) {
      try {
        sessionTokenRef.current = await createAutocompleteSessionToken();
      } catch {
        sessionTokenRef.current = undefined;
      }
    }
    return sessionTokenRef.current;
  }, []);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    sessionTokenRef.current = undefined;
    setSuggestions([]);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    if (debouncedQuery.length < minLength) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const token = await ensureSessionToken();
        const results = await fetchPlaceSuggestions(debouncedQuery, token);
        if (cancelled || requestId !== requestIdRef.current) return;
        setSuggestions(results);
      } catch {
        if (cancelled || requestId !== requestIdRef.current) return;
        setError("Address suggestions are unavailable right now.");
        setSuggestions([]);
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, enabled, ensureSessionToken, minLength]);

  const resolveSuggestion = useCallback(
    async (suggestion: PlaceSuggestion): Promise<ParsedPlaceAddress | null> => {
      try {
        const parsed = await resolvePredictionAddress(suggestion.prediction);
        // Selecting a place ends the autocomplete session.
        sessionTokenRef.current = undefined;
        setSuggestions([]);
        return parsed;
      } catch {
        setError("Could not load the selected address details.");
        return null;
      }
    },
    [],
  );

  return {
    enabled,
    suggestions,
    isLoading,
    error,
    setQuery,
    resolveSuggestion,
    reset,
  };
}
