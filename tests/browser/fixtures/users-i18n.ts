import users from "@/locales/es/users.json";
export function useTranslation() {
  return { t: (key: string) => {
    const value = key === "common.actions.edit" ? "Editar" : key.split(".").slice(1).reduce<unknown>((result, part) => (result as Record<string, unknown>)?.[part], users);
    return String(value ?? key);
  } };
}
