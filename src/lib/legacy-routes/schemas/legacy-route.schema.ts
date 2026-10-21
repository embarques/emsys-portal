import { z } from "zod";

import { normalizeRouteCities } from "@/lib/legacy-routes/utils/route-cities";

/** One manually entered city or ZIP code. Commas would split it when stored as `content`. */
const routeCityEntrySchema = z.object({
  value: z.string().refine((value) => !value.includes(","), "Commas are not allowed."),
});

export const legacyRouteFormSchema = z.object({
  name: z.string().trim().min(1, "Required."),
  cities: z
    .array(routeCityEntrySchema)
    .refine((entries) => normalizeRouteCities(entries.map((entry) => entry.value)).length > 0, "Required."),
});

/** Create/update body; `id` is assigned by the API. */
export const legacyRoutePayloadSchema = z.object({
  name: z.string().trim().min(1),
  content: z.string().trim().min(1),
});

export const legacyRouteSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  content: z.string().nullish().transform((value) => value ?? ""),
});
