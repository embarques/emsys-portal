import { useState } from "react";

const suggestions = [{ placeId: "test", primaryText: "123 Main St", description: "123 Main St, New York" }];
export function useAddressAutocomplete() {
  const [query, setQuery] = useState("");
  return {
    enabled: true, suggestions: query ? suggestions : [], isLoading: false, setQuery,
    resolveSuggestion: async () => ({ address1: "123 Main St", city: "New York" }),
  };
}
