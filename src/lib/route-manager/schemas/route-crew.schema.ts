import { z } from "zod";

export const routeCrewMembersSchema = z.array(z.object({ id: z.number().int().positive() }))
  .refine((employees) => new Set(employees.map((employee) => employee.id)).size >= 2, {
    message: "Select at least two crew members.",
  });
