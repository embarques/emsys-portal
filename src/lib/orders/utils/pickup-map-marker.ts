/** Standalone truck artwork: no pin, enclosure, or external image request. */

export const PICKUP_MARKER_BASE_SIZE = 32;
export const PICKUP_MARKER_MAX_SIZE = 64;
export const PICKUP_MARKER_BASE_ZOOM = 11;

/** Grow from 32 as the map zooms in; never exceed 64. */
export function pickupMarkerSizeForZoom(zoom: number, baseZoom = PICKUP_MARKER_BASE_ZOOM): number {
  const scaled = PICKUP_MARKER_BASE_SIZE * 2 ** ((zoom - baseZoom) / 4);
  return Math.max(
    PICKUP_MARKER_BASE_SIZE,
    Math.min(PICKUP_MARKER_MAX_SIZE, Math.round(scaled)),
  );
}

function stopNumberFontSize(stopNumber: number): number {
  const digits = String(stopNumber).length;
  if (digits >= 3) return 13;
  if (digits === 2) return 16;
  return 18;
}

function stopNumberMarkup(stopNumber: number | undefined): string {
  if (stopNumber === undefined || !Number.isInteger(stopNumber) || stopNumber < 1) return "";
  return (
    `<text x="17" y="22" text-anchor="middle" dominant-baseline="middle"` +
    ` font-family="Arial,Helvetica,sans-serif" font-size="${stopNumberFontSize(stopNumber)}"` +
    ` font-weight="800" fill="#111827">${stopNumber}</text>`
  );
}

export function buildPickupTruckMarkerUrl(
  color: string,
  selected: boolean,
  stopNumber?: number,
): string {
  const safeColor = color.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
  const truck =
    '<path d="M6 34V10H28V34H6ZM28 20H36L43 28V34H28"/><path d="M29 28H42"/><circle cx="13" cy="36" r="4"/><circle cx="35" cy="36" r="4"/>';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
    `<g stroke-linejoin="round" stroke-linecap="round">` +
    `${selected ? `<g fill="white" stroke="#ea580c" stroke-width="7">${truck}</g>` : ""}` +
    `<g fill="white" stroke="${safeColor}" stroke-width="3.5">${truck}</g>` +
    `</g>${stopNumberMarkup(stopNumber)}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
