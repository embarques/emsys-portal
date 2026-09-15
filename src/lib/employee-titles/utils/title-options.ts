import type { EmployeeTitle } from "@/lib/employee-titles/types";

/** Preserve an existing inactive or legacy title without offering other inactive titles. */
export function getEmployeeTitleOptions(titles: EmployeeTitle[], selected: string) {
  const names = titles.filter((title) => title.active).map((title) => title.name);
  return Array.from(new Set([...names, selected].filter(Boolean))).map((name) => ({
    value: name,
    label: name,
  }));
}
