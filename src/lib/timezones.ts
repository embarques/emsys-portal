import timezones from "../../timezones.json";

/** Keep IANA values intact; Intl supplies names using the device's timezone data. */
export function timezoneOption(value: string, locale: string) {
  const location = value.replaceAll("_", " ");
  let name = "";
  try {
    name = new Intl.DateTimeFormat(locale, {
      timeZone: value,
      timeZoneName: "longGeneric",
    }).formatToParts(0).find(part => part.type === "timeZoneName")?.value ?? "";
  } catch (error) {
    // Older browsers may not recognize a newer IANA identifier. Keep it selectable.
    if (!(error instanceof RangeError)) throw error;
  }
  return {
    value,
    label: name ? `${location} — ${name}` : location,
    keywords: [value, location, ...location.split("/"), name],
  };
}

// Shared by company and branch pickers; avoid repeating Intl work while typing.
const optionsByLocale = new Map<string, ReturnType<typeof timezoneOption>[]>();

export function getTimezoneOptions(locale: string) {
  let options = optionsByLocale.get(locale);
  if (!options) {
    options = [...new Set(timezones)].map(value => timezoneOption(value, locale));
    optionsByLocale.set(locale, options);
  }
  return options;
}
