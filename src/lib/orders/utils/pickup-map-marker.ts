/** Standalone truck artwork: no pin, enclosure, or external image request. */
export function buildPickupTruckMarkerUrl(color: string, selected: boolean): string {
  const safeColor = color.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
  const truck = '<path d="M6 34V10H28V34H6ZM28 20H36L43 28V34H28"/><path d="M29 28H42"/><circle cx="13" cy="36" r="4"/><circle cx="35" cy="36" r="4"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g stroke-linejoin="round" stroke-linecap="round">${selected ? `<g fill="white" stroke="#ea580c" stroke-width="7">${truck}</g>` : ""}<g fill="white" stroke="${safeColor}" stroke-width="3.5">${truck}</g></g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
