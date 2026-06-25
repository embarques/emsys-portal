import { z } from "zod";

export const deliveryFormSchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Delivery name is required."),
  date: z.string().trim().min(1, "Delivery date is required."),
  containerId: z.string().trim().min(1, "Container is required."),
  employeeId: z.string().trim().min(1, "Driver is required."),
  helper1Id: z.string(),
  helper2Id: z.string(),
});

export type DeliveryFormSchema = z.infer<typeof deliveryFormSchema>;
