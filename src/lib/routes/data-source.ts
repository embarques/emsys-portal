/**
 * Routes + active routes data source toggle.
 *
 * Default (true): browser local store — starts empty, persists in localStorage, no API.
 * Set `NEXT_PUBLIC_ROUTES_USE_MOCK=false` to use the EMSYS API instead.
 */
export const ROUTES_USE_MOCK_DATA =
  process.env.NEXT_PUBLIC_ROUTES_USE_MOCK !== "false";
