import { z } from "zod";

export const deliveryFormSchema = z.object({
  id: z.number(),
  name: z.string().trim().min(1, "Delivery name is required."),
  date: z.string().trim().min(1, "Delivery date is required."),
  containerId: z.string().trim().min(1, "Container is required."),
  employeeGroupId: z.string().trim().min(1, "Employee group is required."),
});

export type DeliveryFormSchema = z.infer<typeof deliveryFormSchema>;
