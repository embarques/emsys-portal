import type { Item } from "./types";

export const MOCK_ITEMS: Item[] = [
  {
    itemId: "itm-001",
    description: "Standard shipping box — medium (18×14×12 in)",
    price: 4.5,
    createdAt: "2026-01-10T09:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T14:22:00Z",
  },
  {
    itemId: "itm-002",
    description: "55-gallon plastic barrel — food grade",
    price: 38.0,
    createdAt: "2026-01-15T11:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T11:05:00Z",
  },
  {
    itemId: "itm-003",
    description: "Packing tape roll — 2 in × 110 yd",
    price: 3.25,
    createdAt: "2026-02-03T14:00:00Z",
    createdBy: "Admin User",
    updatedAt: "2026-06-02T18:40:00Z",
  },
  {
    itemId: "itm-004",
    description: "Custom wooden crate — large",
    price: 85.0,
    createdAt: "2026-02-20T08:15:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-01T09:15:00Z",
  },
  {
    itemId: "itm-005",
    description: "Door-to-door delivery service fee",
    price: 25.0,
    createdAt: "2026-03-05T16:45:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-30T16:30:00Z",
  },
  {
    itemId: "itm-006",
    description: "Fragile handling surcharge",
    price: 12.5,
    createdAt: "2026-04-18T10:20:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-28T13:20:00Z",
  },
];

export function cloneItems(): Item[] {
  return MOCK_ITEMS.map((item) => ({ ...item }));
}

export function getItemById(itemId: string): Item | undefined {
  return MOCK_ITEMS.find((item) => item.itemId === itemId);
}
