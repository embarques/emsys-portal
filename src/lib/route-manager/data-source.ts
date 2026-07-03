/**
 * Routes + active routes data source toggle.
 *
 * Default (false): EMSYS API.
 * Set `NEXT_PUBLIC_ROUTES_USE_MOCK=true` to use the browser local store instead.
 */
export const ROUTES_USE_MOCK_DATA =
  process.env.NEXT_PUBLIC_ROUTES_USE_MOCK === "true";
