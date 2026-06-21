/**
 * Thin wrapper over the Google Places (New) API used for address autocomplete.
 *
 * Exposes two operations:
 *  - `fetchPlaceSuggestions`  — predictions for an input string.
 *  - `fetchPlaceAddress`      — resolved address components + GeoJSON location.
 *
 * A session token ties the predictions + details lookup into a single
 * billable autocomplete session (recommended by Google).
 */

import { importGoogleMapsLibrary, isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import {
  createAddressGeoLocation,
  type AddressGeoLocation,
  type ParsedPlaceAddress,
} from "@/lib/customers/types";

export { isGoogleMapsConfigured };

export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  description: string;
  /** Underlying Google prediction, used to resolve full address details. */
  prediction: PlacePrediction;
};

type FormattableText = { text?: string } | null | undefined;

type PlacePrediction = {
  placeId: string;
  mainText?: FormattableText;
  secondaryText?: FormattableText;
  text?: FormattableText;
  toPlace: () => GooglePlace;
};

type AutocompleteSuggestionInstance = {
  placePrediction: PlacePrediction | null;
};

type GoogleAddressComponent = {
  longText?: string | null;
  shortText?: string | null;
  types?: string[];
};

type GoogleLatLng = {
  lat: () => number;
  lng: () => number;
};

type GooglePlace = {
  addressComponents?: GoogleAddressComponent[] | null;
  location?: GoogleLatLng | null;
  fetchFields: (request: { fields: string[] }) => Promise<{ place: GooglePlace }>;
};

type PlacesLibrary = {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (request: {
      input: string;
      sessionToken?: object;
      includedPrimaryTypes?: string[];
      language?: string;
      region?: string;
    }) => Promise<{ suggestions: AutocompleteSuggestionInstance[] }>;
  };
};

let placesLibraryPromise: Promise<PlacesLibrary> | null = null;

function getPlacesLibrary(): Promise<PlacesLibrary> {
  if (!placesLibraryPromise) {
    placesLibraryPromise = importGoogleMapsLibrary<PlacesLibrary>("places").catch((error) => {
      placesLibraryPromise = null;
      throw error;
    });
  }
  return placesLibraryPromise;
}

/** Opaque autocomplete session token; create one per autocomplete session. */
export async function createAutocompleteSessionToken(): Promise<object> {
  const places = await getPlacesLibrary();
  return new places.AutocompleteSessionToken();
}

function readText(value: FormattableText): string {
  return value?.text?.trim() ?? "";
}

export async function fetchPlaceSuggestions(
  input: string,
  sessionToken?: object,
): Promise<PlaceSuggestion[]> {
  const query = input.trim();
  if (!query) return [];

  const places = await getPlacesLibrary();
  const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input: query,
    sessionToken,
    includedPrimaryTypes: ["street_address", "premise", "subpremise"],
  });

  return suggestions
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction): prediction is PlacePrediction => Boolean(prediction))
    .map((prediction) => ({
      placeId: prediction.placeId,
      primaryText: readText(prediction.mainText),
      secondaryText: readText(prediction.secondaryText),
      description: readText(prediction.text),
      prediction,
    }));
}

function findComponent(
  components: GoogleAddressComponent[],
  type: string,
): GoogleAddressComponent | undefined {
  return components.find((component) => component.types?.includes(type));
}

function longValue(components: GoogleAddressComponent[], type: string): string {
  return findComponent(components, type)?.longText?.trim() ?? "";
}

function shortValue(components: GoogleAddressComponent[], type: string): string {
  return findComponent(components, type)?.shortText?.trim() ?? "";
}

function parseAddressComponents(components: GoogleAddressComponent[]): Omit<ParsedPlaceAddress, "location"> {
  const streetNumber = longValue(components, "street_number");
  const route = longValue(components, "route");
  const address1 = [streetNumber, route].filter(Boolean).join(" ").trim();

  const city =
    longValue(components, "locality") ||
    longValue(components, "postal_town") ||
    longValue(components, "sublocality") ||
    longValue(components, "sublocality_level_1") ||
    longValue(components, "administrative_area_level_2");

  const state = shortValue(components, "administrative_area_level_1");
  const zipcode = longValue(components, "postal_code");
  const country = shortValue(components, "country");

  return { address1, city, state, zipcode, country };
}

function readLocation(place: GooglePlace): AddressGeoLocation | null {
  const location = place.location;
  if (!location) return null;

  const latitude = location.lat();
  const longitude = location.lng();
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return createAddressGeoLocation(longitude, latitude);
}

/** Resolve a prediction directly into a parsed address. */
export async function resolvePredictionAddress(
  prediction: PlacePrediction,
): Promise<ParsedPlaceAddress | null> {
  const place = prediction.toPlace();
  await place.fetchFields({ fields: ["addressComponents", "location"] });

  const components = place.addressComponents ?? [];
  return {
    ...parseAddressComponents(components),
    location: readLocation(place),
  };
}

export type { PlacePrediction };
