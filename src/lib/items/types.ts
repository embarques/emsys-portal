import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";

export type Item = {
  itemId: string;
  description: string;
  price: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type ItemFormValues = {
  itemId: string;
  description: string;
  price: string;
  createdBy: string;
};

export type ItemFilterState = {
  query: string;
};

export function createItemId(): string {
  return crypto.randomUUID();
}

export function createEmptyItemForm(createdBy = DEFAULT_CREATED_BY): ItemFormValues {
  return {
    itemId: createItemId(),
    description: "",
    price: "",
    createdBy,
  };
}

export function itemToFormValues(item: Item): ItemFormValues {
  return {
    itemId: item.itemId,
    description: item.description,
    price: item.price.toFixed(2),
    createdBy: item.createdBy,
  };
}

export function formValuesToItem(
  values: ItemFormValues,
  createdAt?: string,
  createdBy?: string,
  updatedAt?: string
): Item {
  const price = Number(values.price);

  if (!values.description.trim()) {
    throw new Error("Description is required.");
  }

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a valid number greater than or equal to 0.");
  }

  return {
    itemId: values.itemId,
    description: values.description.trim(),
    price,
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}
