import { z } from "zod";

import { normalizeRouteCities } from "@/lib/predefined-routes/utils/route-cities";

/** One manually entered city or ZIP code. Commas would split it when stored as `content`. */
const routeCityEntrySchema = z.object({
  value: z.string().refine((value) => !value.includes(","), "Commas are not allowed."),
});

export const predefinedRouteFormSchema = z.object({
  name: z.string().trim().min(1, "Required.").max(200),
  cities: z
    .array(routeCityEntrySchema).max(1000)
    .refine((entries) => normalizeRouteCities(entries.map((entry) => entry.value)).length > 0, "Required."),
});

/** Create/update body; `id` is assigned by the API. */
export const predefinedRoutePayloadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(65536),
});

export const predefinedRouteSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  content: z.string().nullish().transform((value) => value ?? ""),
});
